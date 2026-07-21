import type { Message } from "../../types";
import { isSameLocalDay } from "../user/format";

/** Discord-style grouping window — consecutive messages from same author. */
const GROUP_WINDOW_MS = 7 * 60 * 1000;

function resolveSenderId(message: Message): string {
  const sender = message.sender;
  if (typeof sender === "string") return sender.trim();
  return (sender._id ?? sender.id ?? "").trim();
}

function isGroupableMessage(message: Message): boolean {
  return message.messageType !== "CALL";
}

export function isMessageGrouped(
  previous: Message | undefined,
  current: Message,
): boolean {
  if (!previous || !isGroupableMessage(previous) || !isGroupableMessage(current)) {
    return false;
  }
  const prevSender = resolveSenderId(previous);
  const currSender = resolveSenderId(current);
  if (!prevSender || !currSender || prevSender !== currSender) return false;
  if (!isSameLocalDay(previous.timestamp, current.timestamp)) return false;

  const prevTime = new Date(previous.timestamp).getTime();
  const currTime = new Date(current.timestamp).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(currTime)) return false;

  const delta = currTime - prevTime;
  return delta >= 0 && delta <= GROUP_WINDOW_MS;
}

export function findGroupAnchor(
  messages: Message[],
  index: number,
): Message | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = messages[i];
    if (!isGroupableMessage(candidate)) return undefined;
    return candidate;
  }
  return undefined;
}
