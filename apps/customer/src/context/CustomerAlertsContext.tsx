import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useCustomerAuth } from './CustomerAuthContext';
import api from '../services/api';
import { playRingtone, setupAudioUnlock, isVibrateEnabled, startLoudAlert } from '../utils/ringtones';

// Triggers that warrant the "loud" modal — the customer needs to act
// (food is ready, parcel is packed, individual item is up). Anything
// else stays a quiet toast.
const LOUD_TRIGGERS = new Set(['ORDER_READY', 'PICKUP_READY', 'ITEM_READY']);

// Don't blink for alerts older than this — protects against stale
// unread alerts when the customer ignored the popup hours ago.
// Anything older than 30 min is considered "stale" and stops blinking
// even if it's still marked unread in the DB.
const BLINK_MAX_AGE_MS = 30 * 60 * 1000;

// Same window for retroactively raising the loud popup. If the customer
// opens the PWA shortly after an alert fired (and they missed the socket
// push because they were offline / backgrounded / had the app closed),
// we still want them to hear it.
const POPUP_REPLAY_MAX_AGE_MS = 5 * 60 * 1000;

// Order statuses where blinking still makes sense. Once the kitchen
// marks the order SERVED or it's CANCELLED/REFUNDED, blinking stops
// regardless of whether the customer ever tapped OK on the alert.
const BLINKABLE_ORDER_STATUSES = new Set([
  'CREATED', 'QUEUED', 'PREPARING', 'READY', 'OUT_FOR_SERVICE',
]);

// Item statuses where blinking still makes sense. Once an item is
// SERVED (delivered to the customer) or CANCELLED, no need to flag.
const BLINKABLE_ITEM_STATUSES = new Set([
  'PENDING', 'PREPARING', 'READY',
]);

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
  // True while there's a fresh unread "ready"-class alert for this
  // order AND the order is still in an active state. Returns false if:
  //   - the order is SERVED / CANCELLED / etc. (no point blinking)
  //   - the alert is older than 30 min (stale)
  //   - the alert is already marked read
  // HomePage uses this to blink the order card.
  hasReadyAlertForOrder: (orderId: string | null | undefined, orderStatus?: string | null) => boolean;
  // Same but per order-item. Pass the current item status so a SERVED
  // item stops blinking even if its ITEM_READY alert is still unread.
  hasReadyAlertForOrderItem: (orderItemId: string | null | undefined, itemStatus?: string | null) => boolean;
};

const CustomerAlertsContext = createContext<Ctx>({
  alerts: [], unreadCount: 0,
  loudAlert: null,
  acknowledgeLoudAlert: () => {},
  markRead: () => {}, markAllRead: () => {}, refresh: () => {},
  hasReadyAlertForOrder: () => false,
  hasReadyAlertForOrderItem: () => false,
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

  // Backgrounded-tab safety net. While the PWA tab is hidden (other
  // tab open, phone home-screen, etc.) browsers suspend the socket
  // after ~30s on Chrome/Edge and even faster on iOS. When the tab
  // comes back to focus we (1) refresh the alert list to catch
  // anything that fired during the gap and (2) nudge the socket to
  // reconnect if it's gone half-dead. Combined with the existing
  // POPUP_REPLAY_MAX_AGE_MS window, a customer who returns to the PWA
  // within 5 min of a "ready" alert will still hear the loud popup.
  useEffect(() => {
    if (!isLoggedIn) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      refresh();
      const sock = socketRef.current;
      if (sock && !sock.connected) {
        sock.connect();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [isLoggedIn, refresh]);

  // Belt-and-braces polling for the case where both the socket AND
  // the visibility-change handler fail us (rare, but iOS Safari has
  // been known to do it). 45 s is cheap on the API and barely
  // measurable in mobile data usage, but it guarantees that an alert
  // fired while the tab is in some weird half-suspended state is
  // surfaced within a minute.
  useEffect(() => {
    if (!isLoggedIn) return;
    const POLL_MS = 45_000;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [isLoggedIn, refresh]);

  // Replay missed loud alerts. If the customer wasn't connected when
  // the kitchen marked something ready (PWA closed, network blip,
  // backgrounded tab), the socket push goes to nobody. But the alert
  // row is still created in the DB — so when refresh() pulls it into
  // the list, we promote the freshest unread loud alert to a popup
  // here, mirroring what the socket handler would have done.
  useEffect(() => {
    if (loudAlert) return; // already showing one
    const now = Date.now();
    const candidate = alerts.find((a) =>
      !a.isRead
      && LOUD_TRIGGERS.has(a.trigger)
      && (now - new Date(a.createdAt).getTime()) < POPUP_REPLAY_MAX_AGE_MS,
    );
    if (!candidate) return;
    loudStopRef.current?.stop();
    loudStopRef.current = startLoudAlert(candidate.ringtone, {
      volume: (user as any)?.alertVolume ?? 100,
      vibrate: isVibrateEnabled(),
    });
    setLoudAlert(candidate);
  }, [alerts, loudAlert, user]);

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

  const hasReadyAlertForOrder = useCallback(
    (orderId: string | null | undefined, orderStatus?: string | null) => {
      if (!orderId) return false;
      // If we know the order moved past the ready phase, stop blinking
      // immediately regardless of alert state.
      if (orderStatus && !BLINKABLE_ORDER_STATUSES.has(orderStatus)) return false;
      const now = Date.now();
      return alerts.some((a) => {
        if (a.isRead) return false;
        if (a.orderId !== orderId) return false;
        if (!LOUD_TRIGGERS.has(a.trigger)) return false;
        const ageMs = now - new Date(a.createdAt).getTime();
        return ageMs >= 0 && ageMs < BLINK_MAX_AGE_MS;
      });
    },
    [alerts],
  );

  const hasReadyAlertForOrderItem = useCallback(
    (orderItemId: string | null | undefined, itemStatus?: string | null) => {
      if (!orderItemId) return false;
      if (itemStatus && !BLINKABLE_ITEM_STATUSES.has(itemStatus)) return false;
      const now = Date.now();
      return alerts.some((a) => {
        if (a.isRead) return false;
        if (a.orderItemId !== orderItemId) return false;
        if (a.trigger !== 'ITEM_READY') return false;
        const ageMs = now - new Date(a.createdAt).getTime();
        return ageMs >= 0 && ageMs < BLINK_MAX_AGE_MS;
      });
    },
    [alerts],
  );

  return (
    <CustomerAlertsContext.Provider value={{
      alerts, unreadCount, loudAlert, acknowledgeLoudAlert,
      markRead, markAllRead, refresh,
      hasReadyAlertForOrder, hasReadyAlertForOrderItem,
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
  // The backdrop intentionally does not dismiss — only the explicit OK
  // tap silences the loop. Card itself blinks (opacity) + the bell icon
  // pulses-ring for an extra attention-grabbing effect.
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center animate-blink">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-brand-700 to-red-500 flex items-center justify-center text-white text-3xl animate-ring-blink">
          🔔
        </div>
        <h2 className="text-xl font-black text-slate-900">{alert.title || 'Order ready'}</h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{alert.body}</p>
        <button
          onClick={onAcknowledge}
          className="mt-6 w-full bg-gold-500 hover:bg-gold-600 text-charcoal-900  text-white font-bold py-3.5 rounded-2xl text-sm"
        >
          OK, on my way
        </button>
        <p className="text-[10px] text-slate-400 mt-3">Tap to silence the alert</p>
      </div>
    </div>
  );
}
