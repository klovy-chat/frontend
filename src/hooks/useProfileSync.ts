// useProfileSync.ts
// Live patch pól profilu w otwartym UI (avatar, nazwa).
// Zakres:
//  - unika pełnego refetch listy
//  - live patch nazwy/avatara bez refetch całej listy
// Nowe pole live: event WS + ten hook.
// Przy zmianach: ChatWindow.tsx, Sidebar.tsx.

import { useEffect, useRef } from "react";
import type { WebSocketClient } from "../api/ws";
import { WsType } from "../api/protocol";

interface ProfileInfoUpdate {
  userId: string;
  username?: string | null;
  displayName?: string | null;
  bio?: string | null;
  color?: number | null;
}

interface ProfileImageUpdate {
  userId: string;
  image: string | null;
}

interface ProfileBannerUpdate {
  userId: string;
  banner: string | null;
}

export interface ProfileSyncHandlers {
  onInfo?: (data: ProfileInfoUpdate) => void;
  onImage?: (data: ProfileImageUpdate) => void;
  onBanner?: (data: ProfileBannerUpdate) => void;
}

export function useProfileSync(
  ws: WebSocketClient | null,
  handlers: ProfileSyncHandlers,
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!ws) return;

    const handleInfo = (data: ProfileInfoUpdate) => handlersRef.current.onInfo?.(data);
    const handleImage = (data: ProfileImageUpdate) => handlersRef.current.onImage?.(data);
    const handleBanner = (data: ProfileBannerUpdate) =>
      handlersRef.current.onBanner?.(data);

    const unsubs = [
      ws.subscribe(WsType.PROFILE_UPDATED, handleInfo),
      ws.subscribe(WsType.CONTACT_PROFILE_UPDATED, handleInfo),
      ws.subscribe(WsType.PROFILE_IMAGE_UPDATED, handleImage),
      ws.subscribe(WsType.CONTACT_AVATAR_UPDATED, handleImage),
      ws.subscribe(WsType.PROFILE_BANNER_UPDATED, handleBanner),
      ws.subscribe(WsType.CONTACT_BANNER_UPDATED, handleBanner),
    ];

    return () => unsubs.forEach((u) => u());
  }, [ws]);
}
