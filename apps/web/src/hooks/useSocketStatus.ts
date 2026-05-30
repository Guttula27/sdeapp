import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

// Connection-state hook for an existing socket.io client. Subscribes to
// the built-in connect / disconnect / reconnect events so pages can show
// a "Live / Reconnecting / Offline" pill and trigger a REST backfill the
// moment the socket comes back.
//
// We also expose `reconnectedAt` — a monotonic timestamp of the last
// reconnect — so callers can `useEffect`-trigger backfills cleanly:
//
//   const { reconnectedAt } = useSocketStatus(socket);
//   useEffect(() => { if (reconnectedAt) fetchOrders(); }, [reconnectedAt]);

export type SocketPhase = 'connected' | 'reconnecting' | 'disconnected';

export interface SocketStatus {
  phase: SocketPhase;
  // Ticks every time we re-enter the connected state. Useful as a deps
  // entry on backfill effects without leaking the whole status object.
  reconnectedAt: number;
}

export function useSocketStatus(socket: Socket | null | undefined): SocketStatus {
  const [phase, setPhase] = useState<SocketPhase>(() =>
    socket?.connected ? 'connected' : 'disconnected',
  );
  const [reconnectedAt, setReconnectedAt] = useState(0);

  useEffect(() => {
    if (!socket) return;
    // Seed from current state in case the socket was already connected
    // when we mounted.
    setPhase(socket.connected ? 'connected' : 'disconnected');

    const onConnect = () => {
      setPhase('connected');
      setReconnectedAt(Date.now());
    };
    const onDisconnect = () => setPhase('disconnected');
    const onReconnectAttempt = () => setPhase('reconnecting');
    const onError = () => setPhase('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('error', onError);
    };
  }, [socket]);

  return { phase, reconnectedAt };
}
