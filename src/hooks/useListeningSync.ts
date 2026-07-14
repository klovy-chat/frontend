import { useEffect, useRef } from "react";
import type { WebSocketClient } from "../api/ws";
import { WsType } from "../api/wsProtocol";
import type { ListeningActivity } from "../types";

interface ListeningUpdate {
  userId: string;
  listeningActivity: ListeningActivity | null;
}

export interface ListeningSyncHandlers {
  onListening?: (data: ListeningUpdate) => void;
}

export function useListeningSync(
  ws: WebSocketClient | null,
  handlers: ListeningSyncHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!ws) return;

    const handleListening = (data: ListeningUpdate) =>
      handlersRef.current.onListening?.(data);

    const unsub = ws.subscribe(WsType.USER_LISTENING_CHANGED, handleListening);
    return () => unsub();
  }, [ws]);
}
