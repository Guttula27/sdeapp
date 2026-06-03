import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useCustomerAuth } from './CustomerAuthContext';
import api from '../services/api';
import { playRingtone, setupAudioUnlock, isVibrateEnabled, startLoudAlert } from '../utils/ringtones';

// Triggers that warrant the "loud" modal — order is ready for pickup
// and the customer needs to act. Anything else stays a quiet toast.
const LOUD_TRIGGERS = new Set(['ORDER_READY', 'PICKUP_READY']);

export type CustomerAlert = {
  id: string;
  customerId: string;
  orderId?: string | null;
  orderItemId?: string | null;
  trigger: string;
  title: string;
  body: string;
  ringtone?: string | null;
  sentVia: 'IN_APP' | 'WHATSAPP' | 'BOTH';
  whatsappError?: string | null;
  isRead: boolean;
  createdAt: string;
};

type Ctx = {
  alerts: CustomerAlert[];
  unreadCount: number;
  loudAlert: CustomerAlert | null;
  acknowledgeLoudAlert: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
};

const CustomerAlertsContext = createContext<Ctx>({
  alerts: [], unreadCount: 0,
  loudAlert: null,
  acknowledgeLoudAlert: () => {},
  markRead: () => {}, markAllRead: () => {}, refresh: () => {},
});

// Ringtone playback moved to utils/ringtones.ts — shared with the Profile
// preview button so what users hear in settings matches what plays live.

export function CustomerAlertsProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoggedIn } = useCustomerAuth();
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loudAlert, setLoudAlert] = useState<CustomerAlert | null>(null);
  const loudStopRef = useRef<{ stop: () => void } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const acknowledgeLoudAlert = useCallback(() => {
    loudStopRef.current?.stop();
    loudStopRef.current = null;
    setLoudAlert((cur) => {
      if (cur) {
        // Mark read on dismiss (fire-and-forget; UI already optimistic).
        api.patch(`/customer-alerts/${cur.id}/read`).catch(() => {});
        setAlerts((prev) => prev.map((a) => (a.id === cur.id ? { ...a, isRead: true } : a)));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return null;
    });
  }, []);

  // If a second loud alert arrives while one is still active, stop the
  // previous loop first to avoid two ringtones running on top of each
  // other. The new alert takes the modal slot.
  useEffect(() => {
    return () => { loudStopRef.current?.stop(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const [{ data: list }, { data: cnt }] = await Promise.all([
        api.get('/customer-alerts', { params: { limit: 50 } }),
        api.get('/customer-alerts/unread-count'),
      ]);
      setAlerts(list.data || []);
      setUnreadCount(typeof cnt.data === 'number' ? cnt.data : 0);
    } catch { /* ignore — offline / unauthenticated */ }
  }, [isLoggedIn]);

  useEffect(() => { refresh(); }, [refresh]);

  // Prime the WebAudio context on first user gesture so Socket-triggered
  // alerts can actually produce sound (browsers block audio that isn't
  // user-initiated). Runs once per app mount.
  useEffect(() => { setupAudioUnlock(); }, []);

  // Socket: join customer room, ring + toast on incoming alerts.
  useEffect(() => {
    if (!isLoggedIn || !user?.id || !token) return;
    const url = `${import.meta.env.VITE_WS_URL || 'http://localhost:3001'}/orders`;
    const socket = io(url);
    socketRef.current = socket;
    socket.emit('joinCustomer', user.id);

    socket.on('customerAlert', (alert: CustomerAlert) => {
      setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].slice(0, 50));
      setUnreadCount((c) => c + 1);

      const isLoud = LOUD_TRIGGERS.has(alert.trigger);
      if (isLoud) {
        // Order ready / pickup ready — escalate to the loud modal. The
        // loop runs until the customer taps OK in the modal. We stop any
        // previous loop in case two loud alerts arrive back-to-back.
        loudStopRef.current?.stop();
        loudStopRef.current = startLoudAlert(alert.ringtone, {
          volume: (user as any)?.alertVolume ?? 100,
          vibrate: isVibrateEnabled(),
        });
        setLoudAlert(alert);
      } else {
        playRingtone(alert.ringtone, {
          volume: (user as any)?.alertVolume ?? 70,
          vibrate: isVibrateEnabled(),
        });
        toast(
          (t) => (
            <div className="text-sm">
              <p className="font-bold text-slate-900">{alert.title}</p>
              <p className="text-slate-600 mt-0.5">{alert.body}</p>
              {alert.sentVia === 'IN_APP' && (
                <p className="text-[10px] text-amber-600 mt-1">WhatsApp not configured — shown here only</p>
              )}
            </div>
          ),
          { duration: 6000 },
        );
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [isLoggedIn, user?.id, token]);

  const markRead = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try { await api.patch(`/customer-alerts/${id}/read`); } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
    setUnreadCount(0);
    try { await api.patch('/customer-alerts/read-all'); } catch {}
  }, []);

  return (
    <CustomerAlertsContext.Provider value={{
      alerts, unreadCount, loudAlert, acknowledgeLoudAlert,
      markRead, markAllRead, refresh,
    }}>
      {children}
      {loudAlert && (
        <LoudAlertModal alert={loudAlert} onAcknowledge={acknowledgeLoudAlert} />
      )}
    </CustomerAlertsContext.Provider>
  );
}

export const useCustomerAlerts = () => useContext(CustomerAlertsContext);

// Modal overlay shown while a loud alert is active. Cannot be dismissed
// by tapping outside — the customer must explicitly tap OK to silence.
function LoudAlertModal({ alert, onAcknowledge }: { alert: CustomerAlert; onAcknowledge: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center animate-pulse-slow">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-3xl">
          🔔
        </div>
        <h2 className="text-xl font-black text-slate-900">{alert.title || 'Order ready'}</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{alert.body}</p>
        <button
          onClick={onAcknowledge}
          className="mt-6 w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3.5 rounded-2xl text-sm"
        >
          OK, on my way
        </button>
        <p className="text-[10px] text-slate-400 mt-3">Tap to silence the alert</p>
      </div>
    </div>
  );
}
