/**
 * WebSocket Singleton Service for VocalScout real-time agent query streaming.
 * Manages session lifecycles, video selection resets, and message broadcasting.
 */

type MessageCallback = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private isConnecting: boolean = false;
  private pendingQueue: string[] = [];

  private getWebSocketUrl(): string {
    const url =
      import.meta.env.VITE_BACKEND_WEBSOCKET_PATH ||
      import.meta.env.VITE_WEBSOCKET_PATH;
    return url;
  }

  /**
   * Connects to WebSocket server. Reuses existing session if already connected or connecting.
   */
  public getIsConnecting(): boolean {
    return this.isConnecting;
  }

  public connectWebSocket(forceReconnect: boolean = false): void {
    const wsUrl = this.getWebSocketUrl();

    if (!forceReconnect && this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket session already active or connecting.');
      return;
    }

    if (this.socket) {
      this.closeWebSocket();
    }

    try {
      this.isConnecting = true;
      console.log('Connecting to WebSocket:', wsUrl);
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection opened successfully.');
        this.isConnecting = false;
        this.flushPendingQueue();
      };

      this.socket.onmessage = (event) => {
        console.log('WebSocket message received:', event.data);
        let parsedData = event.data;
        try {
          parsedData = JSON.parse(event.data);
        } catch {
          // Keep as string if not JSON
        }
        this.listeners.forEach((callback) => callback(parsedData));
      };

      this.socket.onerror = (error) => {
        console.warn('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.socket = null;
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      this.isConnecting = false;
    }
  }

  private flushPendingQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.pendingQueue.length > 0) {
      const message = this.pendingQueue.shift();
      if (message) {
        console.log('Flushing queued WebSocket message:', message);
        try {
          this.socket.send(message);
        } catch (err) {
          console.error('Error sending queued WebSocket message:', err);
        }
      }
    }
  }

  /**
   * Closes the active WebSocket session and clears connection.
   */
  public closeWebSocket(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.socket = null;
    }
  }

  /**
   * Sends a JSON payload over the active WebSocket connection.
   * If socket is not open, queues payload and initiates connection.
   */
  public sendWebSocketMessage(payload: object): boolean {
    const messageString = JSON.stringify(payload);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending WebSocket message immediately:', messageString);
        this.socket.send(messageString);
        return true;
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
        return false;
      }
    } else {
      console.log('WebSocket not OPEN (readyState:', this.socket?.readyState, '). Queueing message:', messageString);
      this.pendingQueue.push(messageString);
      this.connectWebSocket();
      return true;
    }
  }

  /**
   * Subscribe to incoming WebSocket messages.
   */
  public subscribeWebSocketMessages(callback: MessageCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

