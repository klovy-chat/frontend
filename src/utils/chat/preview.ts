// preview.ts
// Tip ostatniej wiadomości na liście (optimistic, edit, delete).
// Zakres:
//  - prefer non-temp id przy tym samym timestampie
//  - tip ostatniej wiadomości: optimistic, edit, delete
// Sidebar może wyprzedzić cache — delete musi wykluczyć temp id.
// Przy zmianach: Sidebar.tsx, messageCache.ts, utils/tips.rs.

import { getMessagePreview } from "./messages";
import { unwrapIncomingMessage } from "../../crypto/encrypt";
import {
  channelCacheKey,
  dmCacheKey,
  getCachedTipPreview,
} from "./messageCache";
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

function bumpEntry<T extends { lastMessage?: string; lastMessageTime?: string; lastMessageId?: string }>(
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

function dmPeerId(
  msg: Message,
  currentUserId: string | undefined,
): string | undefined {
  const from = senderId(msg);
  const to = recipientId(msg);
  if (!from) return undefined;
  if (from === currentUserId) return to;
  return from;
}

function tipIsStaleAgainst(
  entry: { lastMessageTime?: string; lastMessageId?: string },
  msg: Message,
): boolean {
  if (!entry.lastMessageId || entry.lastMessageId === msg._id) return false;
  if (!entry.lastMessageTime) return false;
  const existing = Date.parse(entry.lastMessageTime);
  const incoming = Date.parse(messageTime(msg));
  if (!Number.isFinite(existing) || !Number.isFinite(incoming)) return false;
  if (incoming < existing) return true;
  if (incoming > existing) return false;

  return tipIdNewerPreferNonTemp(entry.lastMessageId, msg._id);
}

export function tipIdNewerPreferNonTemp(
  liveId?: string,
  httpId?: string,
): boolean {
  if (!liveId) return false;
  if (!httpId) return true;
  const liveTemp = liveId.startsWith("temp-");
  const httpTemp = httpId.startsWith("temp-");
  if (liveTemp && !httpTemp) return false;
  if (!liveTemp && httpTemp) return true;
  return liveId > httpId;
}

type TipListener = (msg: Message) => void;
const tipListeners = new Set<TipListener>();
const tipRevertListeners = new Set<TipListener>();

export function publishSidebarTipFromMessage(msg: Message) {
  for (const l of tipListeners) {
    try {
      l(msg);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeSidebarTipFromMessage(listener: TipListener): () => void {
  tipListeners.add(listener);
  return () => {
    tipListeners.delete(listener);
  };
}

export function publishSidebarTipRevert(msg: Message) {
  for (const l of tipRevertListeners) {
    try {
      l(msg);
    } catch {
      /* ignore */
    }
  }
}

export function subscribeSidebarTipRevert(listener: TipListener): () => void {
  tipRevertListeners.add(listener);
  return () => {
    tipRevertListeners.delete(listener);
  };
}

export function patchContactsFromMessage(
  contacts: Contact[],
  msg: Message,
  currentUserId: string | undefined,
): Contact[] {
  const peerId = dmPeerId(msg, currentUserId);
  if (!peerId) return contacts;

  const index = contacts.findIndex((c) => c._id === peerId);
  if (index === -1) return contacts;
  if (tipIsStaleAgainst(contacts[index], msg)) return contacts;

  return bumpEntry(contacts, index, {
    lastMessage: getMessagePreview(unwrapIncomingMessage(msg)),
    lastMessageTime: messageTime(msg),
    lastMessageId: msg._id,
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
  if (tipIsStaleAgainst(channels[index], msg)) return channels;

  return bumpEntry(channels, index, {
    lastMessage: getMessagePreview(unwrapIncomingMessage(msg)),
    lastMessageTime: messageTime(msg),
    lastMessageId: msg._id,
  });
}

export function patchContactsFromEditedMessage(
  contacts: Contact[],
  msg: Message,
  currentUserId: string | undefined,
): Contact[] {
  const peerId = dmPeerId(msg, currentUserId);
  if (!peerId) return contacts;
  const index = contacts.findIndex(
    (c) =>
      c._id === peerId &&
      (c.lastMessageId === msg._id ||
        (!c.lastMessageId && c.lastMessageTime === msg.timestamp)),
  );
  if (index === -1) return contacts;
  const next = contacts.slice();
  next[index] = {
    ...next[index],
    lastMessage: getMessagePreview(unwrapIncomingMessage(msg)),
    lastMessageId: msg._id,
  };
  return next;
}

export function patchChannelsFromEditedMessage(
  channels: Channel[],
  msg: Message,
): Channel[] {
  const id = channelId(msg);
  if (!id) return channels;
  const index = channels.findIndex(
    (ch) =>
      ch._id === id &&
      (ch.lastMessageId === msg._id ||
        (!ch.lastMessageId && ch.lastMessageTime === msg.timestamp)),
  );
  if (index === -1) return channels;
  const next = channels.slice();
  next[index] = {
    ...next[index],
    lastMessage: getMessagePreview(unwrapIncomingMessage(msg)),
    lastMessageId: msg._id,
  };
  return next;
}

export function patchContactsOnMessageDeleted(
  contacts: Contact[],
  messageId: string,
): { contacts: Contact[]; changed: boolean; needsRefresh: boolean } {
  const index = contacts.findIndex((c) => c.lastMessageId === messageId);
  if (index === -1) return { contacts, changed: false, needsRefresh: false };

  const tip = getCachedTipPreview(dmCacheKey(contacts[index]._id), {
    excludeId: messageId,
  });
  const next = contacts.slice();
  next[index] = {
    ...next[index],
    lastMessage: tip?.lastMessage,
    lastMessageTime: tip?.lastMessageTime,
    lastMessageId: tip?.lastMessageId,
  };
  return { contacts: next, changed: true, needsRefresh: !tip };
}

export function patchChannelsOnMessageDeleted(
  channels: Channel[],
  messageId: string,
): { channels: Channel[]; changed: boolean; needsRefresh: boolean } {
  const index = channels.findIndex((ch) => ch.lastMessageId === messageId);
  if (index === -1) return { channels, changed: false, needsRefresh: false };
  const tip = getCachedTipPreview(channelCacheKey(channels[index]._id), {
    excludeId: messageId,
  });
  const next = channels.slice();
  next[index] = {
    ...next[index],
    lastMessage: tip?.lastMessage,
    lastMessageTime: tip?.lastMessageTime,
    lastMessageId: tip?.lastMessageId,
  };
  return { channels: next, changed: true, needsRefresh: !tip };
}
