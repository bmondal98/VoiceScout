/**
 * WebSocket Singleton Service for VocalScout real-time agent query streaming.
 * Manages session lifecycles, video selection resets, and message broadcasting.
 */

type MessageCallback = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Set<MessageCallback> = new Set();
  private isConnecting: boolean = false;

  private getWebSocketUrl(): string {
    const url =
      import.meta.env.VITE_BACKEND_WEBSOCKET_PATH ||
      import.meta.env.VITE_WEBSOCKET_PATH ||
      'wss://1kaidzgva0.execute-api.us-east-1.amazonaws.com/prod';
    return url;
  }

  /**
   * Connects to WebSocket server. Closes any existing session first to ensure a clean new session.
   */
  public getIsConnecting(): boolean {
    return this.isConnecting;
  }

  public connectWebSocket(): void {
    const wsUrl = this.getWebSocketUrl();

    // If an existing socket is open or connecting, close it first
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
   */
  public sendWebSocketMessage(payload: object): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not open. ReadyState:', this.socket?.readyState);
      // If connecting, wait briefly and try sending
      if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        setTimeout(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
          }
        }, 1000);
        return true;
      }
      return false;
    }

    try {
      const messageString = JSON.stringify(payload);
      console.log('Sending WebSocket message:', messageString);
      this.socket.send(messageString);
      return true;
    } catch (err) {
      console.error('Error sending WebSocket message:', err);
      return false;
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
