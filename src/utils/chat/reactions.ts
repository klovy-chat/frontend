// reactions.ts
// Zliczanie i optymistyczny toggle reakcji.
// Zakres:
//  - zanim wróci WS
//  - optymistyczny toggle zanim wróci WS
// Serwer i tak autoryzuje; merge.ts broni przed wipe.
// Przy zmianach: MessageBubble.tsx, ws react handler.

import type { MessageReactions } from "../../types";

const MAX_REACTION_KEY_LENGTH = 32;

export function normalizeReactions(raw: unknown): MessageReactions {
  if (!raw || typeof raw !== "object") return {};

  const result: MessageReactions = {};

  for (const [emoji, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!emoji || emoji.length > MAX_REACTION_KEY_LENGTH) continue;

    if (Array.isArray(value)) {
      const ids = value.map(String).filter(Boolean);
      if (ids.length > 0) result[emoji] = ids;
      continue;
    }

    if (value && typeof value === "object" && "users" in value) {
      const users = (value as { users?: unknown[] }).users;
      if (Array.isArray(users)) {
        const ids = users.map(String).filter(Boolean);
        if (ids.length > 0) result[emoji] = ids;
      }
    }
  }

  return result;
}

export function toggleReactionLocal(
  reactions: MessageReactions | undefined,
  emoji: string,
  userId: string,
): MessageReactions {
  const next = { ...(reactions ?? {}) };
  const users = [...(next[emoji] ?? [])];
  const index = users.indexOf(userId);

  if (index >= 0) {
    users.splice(index, 1);
    if (users.length === 0) delete next[emoji];
    else next[emoji] = users;
  } else {
    next[emoji] = [...users, userId];
  }

  return next;
}

export function hasUserReacted(
  reactions: MessageReactions | undefined,
  emoji: string,
  userId: string,
): boolean {
  return reactions?.[emoji]?.includes(userId) ?? false;
}

export function getReactionEntries(
  reactions: MessageReactions | undefined,
): Array<[string, string[]]> {
  if (!reactions) return [];
  return Object.entries(reactions).filter(([, users]) => users.length > 0);
}
