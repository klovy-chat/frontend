// merge.ts
// Łączenie patchy (reakcje): nie pozwalaj pustemu WS wyzerować HTTP.
// Zakres:
//  - prefer non-empty reactions
//  - patch WS nie może wyzerować niepustych reakcji z HTTP
// Każdy nowy „merge field” z WS dodaj tutaj, nie w dymku.
// Przy zmianach: ChatWindow.tsx, reactions.ts.

import type { Message, MessageReactions } from "../../types";

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
  const scanStatus = mergeScanStatus(existing.scanStatus, patch.scanStatus);
  const hideFile =
    scanStatus === "pending" || scanStatus === "blocked";
  return {
    ...existing,
    ...patch,
    scanStatus,
    fileUrl: hideFile
      ? undefined
      : (patch.fileUrl ?? existing.fileUrl),
    pinned: patch.pinned ?? existing.pinned,
    pinnedAt: patch.pinnedAt ?? existing.pinnedAt,
    pinnedBy: patch.pinnedBy ?? existing.pinnedBy,
    reactions: mergePreferReactions(patch.reactions, existing.reactions),
  };
}

function mergeScanStatus(
  existing: Message["scanStatus"],
  patch: Message["scanStatus"],
): Message["scanStatus"] {
  if (existing === "blocked" || patch === "blocked") return "blocked";
  if (existing === "clean" || patch === "clean") return "clean";
  return patch ?? existing;
}
