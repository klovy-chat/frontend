// ws.ts
// Klient WebSocket: reconnect, ping, encrypt ramek, on(type).
// Zakres:
//  - prod bez klucza crypto nie wysyła plaintextu
//  - reconnect, ping, szyfrowanie ramek, subskrypcja on(type)
// Nowy type ramki: tu subskrypcja + ws/handlers.rs pod tą samą nazwą.
// Przy zmianach: protocol.ts, WebSocketContext.tsx, ws/encrypt.rs.

import { sanitizeWsPayload } from "../utils/chat/socketPayload";
import {
  WsFrameCrypto,
  WS_CRYPTO_QUERY_PARAM,
  type WsCryptoSession,
} from "../utils/chat/socketCrypto";
import { getBackendBaseUrl } from "../utils/env/backend";
import { usesDirectBackendUrl } from "../utils/env/appEnv";
import { CLIENT_QUERY_PARAM, CLIENT_QUERY_VALUE } from "../utils/env/clientId";
import { WsType, type WsFrame } from "./protocol";

export type WsHandler = (payload: any) => void;

export type WsStatus = "connecting" | "open" | "closed";
export type WsStatusHandler = (status: WsStatus) => void;

export interface WebSocketClientOptions {
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  resolveCrypto?: () => Promise<WsCryptoSession | undefined>;
}

const CLIENT_PING_INTERVAL_MS = 45_000;

const IDLE_TIMEOUT_MS = 90_000;

function getWsUrl(cryptoToken?: string): string {
  const params = new URLSearchParams({
    [CLIENT_QUERY_PARAM]: CLIENT_QUERY_VALUE,
  });
  if (cryptoToken) {
    params.set(WS_CRYPTO_QUERY_PARAM, cryptoToken);
  }

  if (!usesDirectBackendUrl) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws?${params.toString()}`;
  }
  const base = new URL(getBackendBaseUrl());
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/ws";
  base.search = `?${params.toString()}`;
  base.hash = "";
  return base.toString();
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<WsHandler>>();
  private statusHandlers = new Set<WsStatusHandler>();
  private status: WsStatus = "connecting";
  private closed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly options: Required<
    Pick<WebSocketClientOptions, "reconnectionAttempts" | "reconnectionDelay" | "reconnectionDelayMax">
  >;
  private readonly resolveCrypto?: () => Promise<WsCryptoSession | undefined>;
  private frameCrypto: WsFrameCrypto | null = null;
  private activeCrypto: WsCryptoSession | null = null;

  constructor(options: WebSocketClientOptions = {}) {
    this.options = {
      reconnectionAttempts: options.reconnectionAttempts ?? 12,
      reconnectionDelay: options.reconnectionDelay ?? 2000,
      reconnectionDelayMax: options.reconnectionDelayMax ?? 10000,
    };
    this.resolveCrypto = options.resolveCrypto;
    void this.connect();
  }

  private setStatus(status: WsStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const handler of this.statusHandlers) {
      try {
        handler(status);
      } catch {

      }
    }
  }

  get connectionStatus(): WsStatus {
    return this.status;
  }

  onStatusChange(handler: WsStatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private clearPingTimer() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private bumpIdleTimer() {
    this.clearIdleTimer();
    if (this.closed) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      try {
        this.ws?.close();
      } catch {
        // ignore
      }
    }, IDLE_TIMEOUT_MS);
  }

  private startPingLoop() {
    this.clearPingTimer();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        void this.sendFrame({ type: WsType.PING, payload: {} });
      }
    }, CLIENT_PING_INTERVAL_MS);
  }

  private async ensureFrameCrypto() {
    if (!this.resolveCrypto) {
      this.frameCrypto = null;
      this.activeCrypto = null;
      return;
    }
    const session = await this.resolveCrypto();
    if (!session) {
      this.frameCrypto = null;
      this.activeCrypto = null;
      return;
    }
    this.activeCrypto = session;
    this.frameCrypto = await WsFrameCrypto.create(session);
  }

  private async connect() {
    if (this.closed) return;

    this.setStatus("connecting");
    try {
      await this.ensureFrameCrypto();
    } catch (err) {

      if (import.meta.env.DEV) {
        console.warn("[ws] Nie udało się pobrać klucza szyfrującego:", err);
      }
      this.scheduleReconnect();
      return;
    }

    if (usesDirectBackendUrl && !this.activeCrypto?.token) {
      this.scheduleReconnect();
      return;
    }

    this.ws = new WebSocket(getWsUrl(this.activeCrypto?.token));
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
      this.bumpIdleTimer();
      this.startPingLoop();
    };

    this.ws.onmessage = (ev) => {
      void this.handleMessage(ev.data);
    };

    this.ws.onclose = () => {
      this.clearIdleTimer();
      this.clearPingTimer();
      this.ws = null;
      if (!this.closed) {
        this.setStatus("connecting");
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {

    };
  }

  private async handleMessage(data: string | ArrayBuffer) {
    this.bumpIdleTimer();
    try {
      let raw: string;
      if (typeof data === "string") {
        if (this.frameCrypto) {
          return;
        }
        raw = data;
      } else if (this.frameCrypto) {
        raw = await this.frameCrypto.decrypt(data);
      } else {
        return;
      }

      const frame = JSON.parse(raw) as WsFrame;
      if (!frame.type) return;
      if (frame.type === WsType.PING || frame.type === WsType.PONG) {
        return;
      }
      const safePayload = sanitizeWsPayload(frame.type, frame.payload);
      if (safePayload == null) return;
      this.dispatch(frame.type, safePayload);
    } catch {

    }
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
      void this.connect();
    }, delay);
  }

  private async sendFrame(frame: WsFrame): Promise<boolean> {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    try {
      const raw = JSON.stringify(frame);
      if (this.frameCrypto) {
        const encrypted = await this.frameCrypto.encrypt(raw);
        if (this.ws?.readyState !== WebSocket.OPEN) return false;
        this.ws.send(encrypted);
        return true;
      }
      this.ws.send(raw);
      return true;
    } catch {
      return false;
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

  async send(type: string, payload?: unknown): Promise<boolean> {
    return this.sendFrame({ type, payload: payload ?? {} });
  }

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
    this.clearIdleTimer();
    this.clearPingTimer();
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
