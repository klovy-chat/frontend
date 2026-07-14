import { sanitizeWsPayload } from "../utils/chat/wsPayload";
import { getBackendBaseUrl } from "../utils/env/backendUrl";
import { usesDirectBackendUrl } from "../utils/env/appEnv";
import { CLIENT_QUERY_PARAM, CLIENT_QUERY_VALUE } from "../utils/env/clientId";
import { WsType, type WsFrame } from "./wsProtocol";

export type WsHandler = (payload: any) => void;

export type WsStatus = "connecting" | "open" | "closed";
export type WsStatusHandler = (status: WsStatus) => void;

export interface WebSocketClientOptions {
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
}

function getWsUrl(): string {
  const clientQuery = `${CLIENT_QUERY_PARAM}=${encodeURIComponent(
    CLIENT_QUERY_VALUE,
  )}`;
  if (!usesDirectBackendUrl) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws?${clientQuery}`;
  }
  const base = new URL(getBackendBaseUrl());
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/ws";
  base.search = `?${clientQuery}`;
  base.hash = "";
  return base.toString();
}

/** Klient natywnego WebSocket — odpowiednik HTTP `apiRequest` z client.ts. */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<WsHandler>>();
  private statusHandlers = new Set<WsStatusHandler>();
  private status: WsStatus = "connecting";
  private closed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly options: Required<WebSocketClientOptions>;

  constructor(options: WebSocketClientOptions = {}) {
    this.options = {
      reconnectionAttempts: options.reconnectionAttempts ?? 12,
      reconnectionDelay: options.reconnectionDelay ?? 2000,
      reconnectionDelayMax: options.reconnectionDelayMax ?? 10000,
    };
    this.connect();
  }

  private setStatus(status: WsStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) {
      try {
        handler(status);
      } catch {
        // ignoruj błędy subskrybentów statusu
      }
    }
  }

  get connectionStatus(): WsStatus {
    return this.status;
  }

  /** Subskrybuj zmiany stanu połączenia. Wywołuje handler od razu z bieżącym stanem. */
  onStatusChange(handler: WsStatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private connect() {
    if (this.closed) return;

    this.setStatus("connecting");
    this.ws = new WebSocket(getWsUrl());

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
    };

    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const frame = JSON.parse(ev.data) as WsFrame;
        if (!frame.type) return;
        if (frame.type === WsType.PING) {
          this.sendFrame({ type: WsType.PONG, payload: {} });
          return;
        }
        if (frame.type === WsType.PONG) return;
        const safePayload = sanitizeWsPayload(frame.type, frame.payload);
        if (safePayload == null) return;
        this.dispatch(frame.type, safePayload);
      } catch {
        // ignoruj uszkodzone ramki
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.closed) {
        this.setStatus("connecting");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // reconnect obsługuje onclose
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    if (
      this.options.reconnectionAttempts !== Infinity &&
      this.reconnectAttempts >= this.options.reconnectionAttempts
    ) {
      this.setStatus("closed");
      return;
    }

    const delay = Math.min(
      this.options.reconnectionDelay * Math.pow(1.5, this.reconnectAttempts),
      this.options.reconnectionDelayMax,
    );
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendFrame(frame: WsFrame) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private dispatch(type: string, payload: unknown) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error(`[ws] handler error for "${type}":`, err);
        }
      }
    }
  }

  /** Wyślij wiadomość do serwera. */
  send(type: string, payload?: unknown) {
    this.sendFrame({ type, payload: payload ?? {} });
  }

  /** Subskrybuj typ wiadomości z serwera. Zwraca funkcję rezygnacji. */
  subscribe(type: string, handler: WsHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type: string, handler: WsHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  close() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus("closed");
    this.handlers.clear();
    this.statusHandlers.clear();
  }
}
