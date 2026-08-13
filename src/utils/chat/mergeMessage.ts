import type { Message, MessageReactions } from "../../types";

/** Prefer non-empty reactions so a partial WS/HTTP patch cannot wipe chips. */
export function mergePreferReactions(
  incoming: MessageReactions | undefined,
  existing: MessageReactions | undefined,
): MessageReactions | undefined {
  const inKeys = incoming && Object.keys(incoming).length > 0;
  if (inKeys) return incoming;
  const exKeys = existing && Object.keys(existing).length > 0;
  if (exKeys) return existing;
  return incoming ?? existing;
}

export function mergeMessagePatch(existing: Message, patch: Message): Message {
  return {
    ...existing,
    ...patch,
    // Partial WS edits must not wipe pin/reactions with undefined.
    pinned: patch.pinned ?? existing.pinned,
    pinnedAt: patch.pinnedAt ?? existing.pinnedAt,
    pinnedBy: patch.pinnedBy ?? existing.pinnedBy,
    reactions: mergePreferReactions(patch.reactions, existing.reactions),
  };
}
