import { getMessagePreview } from "./messages";
import type { Channel, Contact, Message } from "../../types";

function senderId(msg: Message): string | undefined {
  const sender = msg.sender;
  if (!sender) return undefined;
  return typeof sender === "string" ? sender : sender._id ?? sender.id;
}

function recipientId(msg: Message): string | undefined {
  const recipient = msg.recipient;
  if (!recipient) return undefined;
  return typeof recipient === "string" ? recipient : recipient._id ?? recipient.id;
}

function channelId(msg: Message): string | undefined {
  if (typeof msg.channelId === "string") return msg.channelId;
  if (typeof msg.channel === "string") return msg.channel;
  return undefined;
}

function messageTime(msg: Message): string {
  return msg.timestamp || new Date().toISOString();
}

function bumpEntry<T extends { lastMessage?: string; lastMessageTime?: string }>(
  list: T[],
  index: number,
  patch: Partial<T>,
): T[] {
  const entry = { ...list[index], ...patch };
  const next = list.slice();
  next.splice(index, 1);
  next.unshift(entry);
  return next;
}

export function patchContactsFromMessage(
  contacts: Contact[],
  msg: Message,
  currentUserId: string | undefined,
): Contact[] {
  const peerId = (() => {
    const from = senderId(msg);
    const to = recipientId(msg);
    if (!from) return undefined;
    if (from === currentUserId) return to;
    return from;
  })();
  if (!peerId) return contacts;

  const index = contacts.findIndex((c) => c._id === peerId);
  if (index === -1) return contacts;

  return bumpEntry(contacts, index, {
    lastMessage: getMessagePreview(msg),
    lastMessageTime: messageTime(msg),
  });
}

export function patchChannelsFromMessage(
  channels: Channel[],
  msg: Message,
): Channel[] {
  const id = channelId(msg);
  if (!id) return channels;

  const index = channels.findIndex((ch) => ch._id === id);
  if (index === -1) return channels;

  return bumpEntry(channels, index, {
    lastMessage: getMessagePreview(msg),
    lastMessageTime: messageTime(msg),
  });
}
