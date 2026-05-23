import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(outletId: string): Socket {
  if (!socket) {
    socket = io(`${import.meta.env.VITE_WS_URL || 'http://localhost:3001'}/orders`, {
      auth: { token: localStorage.getItem('token') },
    });
  }
  socket.emit('joinOutlet', outletId);
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
