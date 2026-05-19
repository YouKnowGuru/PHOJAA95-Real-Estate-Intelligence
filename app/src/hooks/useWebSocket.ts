import { useEffect, useRef, useCallback } from "react";
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
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:5173/ws";
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

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

const wsService = new WebSocketService();

export function useWebSocket(token?: string) {
  const queryClient = useQueryClient();

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
    },
    [queryClient]
  );

  useEffect(() => {
    wsService.connect(token);

    const unsubProperty = wsService.subscribe("property:updated", handlePropertyUpdate);
    const unsubPropertyCreate = wsService.subscribe("property:created", handlePropertyUpdate);
    const unsubNotification = wsService.subscribe("notification:new", handleNotification);
    const unsubAttendance = wsService.subscribe("attendance:updated", handleAttendance);

    return () => {
      unsubProperty();
      unsubPropertyCreate();
      unsubNotification();
      unsubAttendance();
      wsService.disconnect();
    };
  }, [token, handlePropertyUpdate, handleNotification, handleAttendance]);

  return {
    isConnected: wsService.isConnected(),
    send: wsService.send.bind(wsService),
  };
}

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = wsService.subscribe("notification:new", (_data) => {
      queryClient.invalidateQueries({ queryKey: ["notification", "list"] });
    });

    return unsub;
  }, [queryClient]);

  return null;
}
