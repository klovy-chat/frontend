// FriendsCache.tsx
// Mostek ciepłego cache znajomy/blokada poza oknem DM.
// Zakres:
//  - composer nie miga loadingiem przy powrocie
//  - lifecycle magazynu friendsCache.ts poza oknem DM
// Po block/unfriend wołaj patch cache, nie tylko setState w oknie.
// Przy zmianach: friendsCache.ts, ChatWindow.tsx.

import { useEffect } from "react";
import { useWebSocket } from "../../context/WebSocketContext";
import { WsType } from "../../api/protocol";
import {
  invalidateFriendshipCache,
  patchCachedFriendship,
} from "../../utils/chat/friendsCache";
import type { Contact } from "../../types";

export function FriendsCache() {
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
