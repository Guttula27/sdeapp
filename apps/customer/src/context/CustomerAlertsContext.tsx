import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useCustomerAuth } from './CustomerAuthContext';
import api from '../services/api';

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

// Synthesize a short ring with WebAudio so we don't need to ship an mp3.
// Different "ringtone" keys pick different pitch envelopes, mirroring the
// alertRingtone choice on the user record.
function playRing(kind?: string | null) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const now = ac.currentTime;

    const tones: Record<string, { freq: number; dur: number }[]> = {
      chime: [{ freq: 880, dur: 0.18 }, { freq: 1320, dur: 0.22 }],
      bell:  [{ freq: 1568, dur: 0.4 }],
      ping:  [{ freq: 2093, dur: 0.12 }, { freq: 2093, dur: 0.12 }],
      buzz:  [{ freq: 200, dur: 0.25 }, { freq: 200, dur: 0.25 }],
    };
    const seq = tones[kind || 'chime'] || tones.chime;

    let t = now;
    seq.forEach(({ freq, dur }) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur + 0.06;
    });
    setTimeout(() => ac.close().catch(() => {}), (t - now + 0.5) * 1000);
  } catch { /* audio unsupported, silent fallback */ }
}

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
      playRing(alert.ringtone);
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
