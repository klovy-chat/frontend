import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { getMessages } from "../../api/messages";
import { getChannelMessages } from "../../api/channels";
import { formatListLastMessage } from "../../utils/chat/messages";
import type { Contact, Channel } from "../../types";

const authors = new Map<string, string>();

export function LastMessagePreview({ kind, entry }: { kind: "dm" | "channel"; entry: Contact | Channel }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const key = `${user?.id}:${kind}:${entry._id}:${entry.lastMessageId ?? entry.lastMessageTime}`;
  const [resolved, setResolved] = useState<{ key: string; author: string } | null>(null);
  const author = entry.lastMessageSenderId ?? authors.get(key) ?? (resolved?.key === key ? resolved.author : undefined);

  useEffect(() => {
    if (author || !user || !entry.lastMessage) return;
    const controller = new AbortController();
    const request = kind === "dm" ? getMessages : getChannelMessages;
    void request(entry._id, { limit: 1, signal: controller.signal }).then(page => {
      const message = page.messages.find(m => entry.lastMessageId ? m._id === entry.lastMessageId : m.timestamp === entry.lastMessageTime);
      if (!message || controller.signal.aborted) return;
      const id = typeof message.sender === "string" ? message.sender : message.sender?._id ?? message.sender?.id;
      if (!id) return;
      if (authors.size >= 500) authors.clear();
      authors.set(key, id);
      setResolved({ key, author: id });
    }).catch(() => {  });
    return () => controller.abort();
  }, [key, author, user?.id, kind, entry._id, entry.lastMessageId, entry.lastMessageTime, entry.lastMessage]);

  const message = formatListLastMessage(entry.lastMessage ?? "");
  return <>{author && author === user?.id ? t("chat.list.ownPreview", { message }) : message}</>;
}
