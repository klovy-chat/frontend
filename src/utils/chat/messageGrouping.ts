import type { Message } from "../../types";
import { getUserId, isSameLocalDay } from "../user/format";

/** Discord-style grouping window — consecutive messages from same author. */
const GROUP_WINDOW_MS = 7 * 60 * 1000;

function resolveSenderId(message: Message): string {
  const sender = message.sender;
  if (typeof sender === "string") return sender;
  return getUserId(sender);
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
  if (resolveSenderId(previous) !== resolveSenderId(current)) return false;
  if (!isSameLocalDay(previous.timestamp, current.timestamp)) return false;

  const prevTime = new Date(previous.timestamp).getTime();
  const currTime = new Date(current.timestamp).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(currTime)) return false;

  const delta = currTime - prevTime;
  return delta >= 0 && delta <= GROUP_WINDOW_MS;
}
