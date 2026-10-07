// Napisane przy użyciu GPT Astry bo nie mialem sil sie z tym bawic, aczkolwiek działać działa
import { useEffect, useState } from "react";
import { getMessages } from "../api/messages";
import { getChannelMessages } from "../api/channels";
import type { Channel, Contact } from "../types";

export function useCallCount(contacts: Contact[], channels: Channel[]) {
  const [count, setCount] = useState<number | null>(null);
  
  const key = JSON.stringify([
    contacts.map(c => [c._id, c.lastMessageId, c.lastMessageTime]),
    channels.map(c => [c._id, c.lastMessageId, c.lastMessageTime]),
  ]);
  useEffect(() => {
    const abort = new AbortController();
    setCount(null);
    const sources = [
      ...contacts.map(c => ({ id: c._id, channel: false })),
      ...channels.map(c => ({ id: c._id, channel: true })),
    ];
    const ids = new Set<string>();
    let cursor = 0;
    async function scan() {
      while (cursor < sources.length && !abort.signal.aborted) {
        const source = sources[cursor++];
        let before: string | undefined;
        while (!abort.signal.aborted) {
          const opts = { before, limit: 100, signal: abort.signal };
          const page = source.channel ? await getChannelMessages(source.id, opts) : await getMessages(source.id, opts);
          if (abort.signal.aborted) return;
          for (const message of page.messages) {
            if (message.messageType === "CALL" && !message.deleted) ids.add(message._id);
          }
          const oldest = [...page.messages].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
          if (!oldest || page.hasMore === false || (page.hasMore === undefined && page.messages.length < 100)) break;
          if (oldest._id === before) throw new Error("Call history cursor did not advance");
          before = oldest._id;
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(3, sources.length) }, scan))
      .then(() => { if (!abort.signal.aborted) setCount(ids.size); })
      .catch(() => { if (!abort.signal.aborted) { setCount(null); abort.abort(); } });
    return () => abort.abort();
  }, [key]);
  return count;
}
