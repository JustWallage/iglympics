import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

type EventHandler = (data: unknown) => void;

interface WSContextType {
  lastEvent: { type: string; payload: unknown } | null;
  subscribe: (type: string, handler: EventHandler) => () => void;
}

const WebSocketContext = createContext<WSContextType | null>(null);

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx)
    throw new Error("useWebSocket must be used within WebSocketProvider");
  return ctx;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [lastEvent, setLastEvent] = useState<WSContextType["lastEvent"]>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setLastEvent(parsed);
        const handlers = handlersRef.current.get(parsed.type);
        if (handlers) {
          handlers.forEach((h) => h(parsed.payload));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((type: string, handler: EventHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ lastEvent, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}
