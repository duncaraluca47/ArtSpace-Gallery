import type { Artwork } from "../state/artworksStore";
import { getAccessToken } from "./authToken";

export type WebSocketMessageType = "artworks_created" | "generation_stopped";

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: Artwork[];
  timestamp?: string;
}

export type WebSocketListener = (message: WebSocketMessage) => void;

/**
 * Manages WebSocket connection for real-time artwork updates
 * Automatically reconnects on disconnect
 */
export class RealtimeArtworkService {
  private ws: WebSocket | null = null;
  private listeners: Set<WebSocketListener> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private url: string;
  private isIntentionallyClosed = false;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "";
      this.url = backendUrl
        .replace(/^http:\/\//i, "ws://")
        .replace(/^https:\/\//i, "wss://");
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isIntentionallyClosed = false;
        const socketUrl = new URL(this.url, window.location.origin);
        const token = getAccessToken();

        if (token) {
          socketUrl.searchParams.set("accessToken", token);
        }

        this.ws = new WebSocket(socketUrl.toString());

        this.ws.addEventListener("open", () => {
          console.log("✓ Connected to realtime artwork updates");
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.addEventListener("message", (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.notifyListeners(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        });

        this.ws.addEventListener("error", (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        });

        this.ws.addEventListener("close", () => {
          this.handleClose();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket close and attempt reconnection
   */
  private handleClose() {
    if (this.isIntentionallyClosed) {
      console.log("WebSocket connection closed (intentional)");
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(
        `Reconnecting to WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  /**
   * Subscribe to artwork updates
   */
  subscribe(listener: WebSocketListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of a new message
   */
  private notifyListeners(message: WebSocketMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        console.error("Error in WebSocket listener:", error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let realtimeService: RealtimeArtworkService | null = null;

export function getRealtimeArtworkService(): RealtimeArtworkService {
  if (!realtimeService) {
    realtimeService = new RealtimeArtworkService();
  }
  return realtimeService;
}
