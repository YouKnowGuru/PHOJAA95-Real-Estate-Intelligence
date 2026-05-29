import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

type WebSocketMessage = {
  type: string;
  payload: Record<string, unknown>;
};

type EventCallback = (data: Record<string, unknown>) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private shouldReconnect = true;

  constructor() {
    // Security: Default to secure WebSocket (wss://) in production.
    // Only use ws:// for localhost development.
    const isLocalhost = typeof window !== "undefined" && (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
    const defaultUrl = isLocalhost ? "ws://localhost:5173/ws" : "wss://localhost:5173/ws";
    const wsUrl = import.meta.env.VITE_WS_URL || defaultUrl;
    this.url = wsUrl;
  }

  connect(token?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;

    const wsUrl = token ? `${this.url}?token=${token}` : this.url;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit("connected", {});
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.emit(message.type, message.payload);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onclose = () => {
        this.emit("disconnected", {});
        if (this.shouldReconnect) {
          this.attemptReconnect(token);
        }
      };

      this.ws.onerror = (error) => {
        this.emit("error", { error });
      };
    } catch {
      // Failed to create WebSocket
    }
  }

  private attemptReconnect(token?: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.shouldReconnect) {
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => this.connect(token), this.reconnectDelay);
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Check if WebSocket is currently connected */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
    this.listeners.get("*")?.forEach((callback) => callback({ event, ...data }));
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /** Get connection state (for hooks that need reactivity) */
  getConnectionState(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const wsService = new WebSocketService();

export function useWebSocket(token?: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const handlePropertyUpdate = useCallback(
    (_data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["property", "list"] });
      queryClient.invalidateQueries({ queryKey: ["property", "getById"] });
      queryClient.invalidateQueries({ queryKey: ["property", "pendingApprovals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
    [queryClient]
  );

  const handleNotification = useCallback(
    (_data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["notification", "list"] });
    },
    [queryClient]
  );

  const handleAttendance = useCallback(
    (_data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", "list"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "myAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "dailyStatus"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "monthlySummary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "allStaffStats"] });
    },
    [queryClient]
  );

  useEffect(() => {
    // Only connect if not already connected (prevents multiple connections)
    if (!wsService.isConnected()) {
      wsService.connect(token);
    }

    const unsubProperty = wsService.subscribe("property:updated", handlePropertyUpdate);
    const unsubPropertyCreate = wsService.subscribe("property:created", handlePropertyUpdate);
    const unsubNotification = wsService.subscribe("notification:new", handleNotification);
    const unsubAttendance = wsService.subscribe("attendance:updated", handleAttendance);

    // Update connection state periodically
    const interval = setInterval(() => {
      setIsConnected(wsService.getConnectionState());
    }, 1000);

    return () => {
      unsubProperty();
      unsubPropertyCreate();
      unsubNotification();
      unsubAttendance();
      clearInterval(interval);
      // NOTE: We do NOT disconnect here because other components may be using
      // the same WebSocket. Disconnect only on app unmount.
    };
  }, [token, handlePropertyUpdate, handleNotification, handleAttendance]);

  return {
    isConnected,
    send: wsService.send.bind(wsService),
  };
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only subscribe — do NOT connect/disconnect here.
    // The useWebSocket hook manages the connection lifecycle.
    const unsub = wsService.subscribe("notification:new", (_data) => {
      queryClient.invalidateQueries({ queryKey: ["notification", "list"] });
    });

    return unsub;
  }, [queryClient]);

  return null;
}
