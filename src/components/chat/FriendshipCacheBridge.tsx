import { useEffect } from "react";
import { useWebSocket } from "../../context/WebSocketContext";
import { WsType } from "../../api/wsProtocol";
import {
  invalidateFriendshipCache,
  patchCachedFriendship,
} from "../../utils/chat/friendshipCache";
import type { Contact } from "../../types";

/**
 * Keeps friendshipCache coherent when ChatPage (Sidebar) is unmounted
 * (Settings / Invite) and when the peer accepts a request / block toggles.
 */
export function FriendshipCacheBridge() {
  const ws = useWebSocket();

  useEffect(() => {
    if (!ws) return;

    const onAdded = (e: { contact?: Contact }) => {
      const id = e.contact?._id;
      if (id) invalidateFriendshipCache(id);
      else invalidateFriendshipCache();
    };
    const onRemoved = (e: { userId?: string }) => {
      const id = e.userId;
      if (id) invalidateFriendshipCache(id);
      else invalidateFriendshipCache();
    };
    const onBlock = (e: {
      contactId?: string;
      isBlockedByMe?: boolean;
      isBlockedByOther?: boolean;
    }) => {
      const id = e.contactId;
      if (!id) return;
      if (typeof e.isBlockedByMe === "boolean") {
        patchCachedFriendship(id, { isBlockedByMe: e.isBlockedByMe });
      }
      if (typeof e.isBlockedByOther === "boolean") {
        patchCachedFriendship(id, { isBlockedByOther: e.isBlockedByOther });
      }
      if (
        typeof e.isBlockedByMe !== "boolean" &&
        typeof e.isBlockedByOther !== "boolean"
      ) {
        invalidateFriendshipCache(id);
      }
    };

    const unsubs = [
      ws.subscribe(WsType.FRIENDSHIP_ADDED, onAdded),
      ws.subscribe(WsType.FRIENDSHIP_REMOVED, onRemoved),
      ws.subscribe(WsType.CONTACT_BLOCK_UPDATED, onBlock),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [ws]);

  return null;
}
