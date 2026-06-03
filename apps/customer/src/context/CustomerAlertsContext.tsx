import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useCustomerAuth } from './CustomerAuthContext';
import api from '../services/api';
import { playRingtone, setupAudioUnlock, isVibrateEnabled } from '../utils/ringtones';

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
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
};

const CustomerAlertsContext = createContext<Ctx>({
  alerts: [], unreadCount: 0,
  markRead: () => {}, markAllRead: () => {}, refresh: () => {},
});

// Ringtone playback moved to utils/ringtones.ts — shared with the Profile
// preview button so what users hear in settings matches what plays live.

export function CustomerAlertsProvider({ children }: { children: ReactNode }) {
  const { user, token, isLoggedIn } = useCustomerAuth();
  const [alerts, setAlerts] = useState<CustomerAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

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
      // Use the user's saved volume + per-device vibrate pref so live
      // alerts behave the same as the preview.
      playRingtone(alert.ringtone, {
        volume: (user as any)?.alertVolume ?? 70,
        vibrate: isVibrateEnabled(),
      });
      // The WhatsApp-not-configured fallback is exactly this toast — the body
      // is the rendered message, and it surfaces under the in-app alerts feed.
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
    <CustomerAlertsContext.Provider value={{ alerts, unreadCount, markRead, markAllRead, refresh }}>
      {children}
    </CustomerAlertsContext.Provider>
  );
}

export const useCustomerAlerts = () => useContext(CustomerAlertsContext);
