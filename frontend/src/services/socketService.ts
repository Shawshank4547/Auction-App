import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private currentAuctionId: string | null = null;

  connect(token: string): Socket {
    // If already connected with a live socket, return it
    if (this.socket?.connected) return this.socket;

    // If socket exists but disconnected, clean it up first
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      // Re-join auction room automatically after reconnect
      if (this.currentAuctionId) {
        console.log('[Socket] Re-joining auction room:', this.currentAuctionId);
        this.socket?.emit('auction:rejoin', { auctionId: this.currentAuctionId });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentAuctionId = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  joinAuction(auctionId: string) {
    this.currentAuctionId = auctionId;
    this.socket?.emit('auction:join', { auctionId });
  }

  leaveAuction(auctionId: string) {
    if (this.currentAuctionId === auctionId) {
      this.currentAuctionId = null;
    }
    this.socket?.emit('auction:leave', { auctionId });
  }

  sendChatMessage(auctionId: string, message: string) {
    this.socket?.emit('chat:send', { auctionId, message });
  }

  on<T = unknown>(event: string, callback: (data: T) => void): () => void {
    this.socket?.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void) {
    this.socket?.off(event, callback);
  }
}

export const socketService = new SocketService();
export default socketService;