import { LoadingSkeleton } from "../common/LoadingSkeleton";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneMissed, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getMessages } from "../../api/messages";
import { getChannelMessages } from "../../api/channels";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../common/Avatar";
import { userLabel, getUserId } from "../../utils/user/format";
import type { ChatTarget, Contact, Channel, Message } from "../../types";
import "../../styles/nav/home.css";

interface Props { contacts: Contact[]; channels: Channel[]; onSelect: (target: ChatTarget) => void; }
interface Source { target: ChatTarget; before?: string; done: boolean; }
interface Record { message: Message; target: ChatTarget; }

export function CallsView({ contacts, channels, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const sources = useRef<Source[]>([]);
  const controller = useRef<AbortController>();
  const latest = useRef({ contacts, channels });
  latest.current = { contacts, channels };
  const sourceKey = JSON.stringify([contacts.map(c => c._id).sort(), channels.map(c => c._id).sort()]);

  async function load(reset = false) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (reset) {
      sources.current = [
        ...latest.current.contacts.map(contact => ({ target: { type: "dm", contact } as ChatTarget, done: false })),
        ...latest.current.channels.map(channel => ({ target: { type: "channel", channel } as ChatTarget, done: false })),
      ];
      setRecords([]);
    }
    setBusy(true);
    setFailed(false);
    const pending = sources.current.filter(s => !s.done);
    let cursor = 0;
    let errors = false;
    const found: Record[] = [];
    
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (cursor < pending.length && !abort.signal.aborted) {
        const source = pending[cursor++];
        try {
          const opts = { before: source.before, limit: 100, signal: abort.signal };
          const page = source.target.type === "dm"
            ? await getMessages(source.target.contact._id, opts)
            : await getChannelMessages(source.target.channel._id, opts);
          if (abort.signal.aborted) return;
          found.push(...page.messages.filter(m => m.messageType === "CALL" && !m.deleted).map(message => ({ message, target: source.target })));
          const oldest = [...page.messages].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
          source.done = !oldest || page.hasMore === false || (page.hasMore === undefined && page.messages.length < 100) || oldest._id === source.before;
          source.before = oldest?._id;
        } catch { if (!abort.signal.aborted) errors = true; }
      }
    }));
    if (abort.signal.aborted) return;
    setRecords(prev => Array.from(new Map([...prev, ...found].map(r => [r.message._id, r])).values()).sort((a, b) => Date.parse(b.message.timestamp) - Date.parse(a.message.timestamp)));
    setMore(sources.current.some(s => !s.done));
    setFailed(errors);
    setBusy(false);
  }

  useEffect(() => { void load(true); return () => controller.current?.abort(); }, [sourceKey]);

  return <section className="workspace-home calls-view">
    <header className="workspace-home__header calls-view__header">
      <div><h1>{t("nav.items.calls")}</h1><p>{t("chat.calls.historySubtitle")}</p></div>
      <button type="button" className="calls-view__refresh" disabled={busy} onClick={() => void load(true)} aria-label={t("chat.calls.refresh")}><RefreshCw size={18} /></button>
    </header>
    {failed && <p role="alert">{t("chat.calls.loadError")}</p>}
    {busy && <LoadingSkeleton label={t("chat.calls.loading")} />}
    {!busy && !failed && records.length === 0 && <p className="workspace-home__empty">{t("chat.calls.emptyHistory")}</p>}
    <div className="workspace-home__recent">{records.map(({ message, target }) => {
      const contact = target.type === "dm" ? target.contact : null;
      const name = contact ? userLabel(contact) : target.type === "channel" ? target.channel.name : "";
      const seconds = Math.floor((message.durationMs ?? 0) / 1000);
      const missed = (message.durationMs ?? 0) <= 0;
      const outgoing = getUserId(message.sender) === user?.id;
      return <button type="button" key={message._id} className="workspace-home__row" onClick={() => onSelect(target)}>
        <Avatar displayName={name} image={contact?.image ?? (target.type === "channel" ? target.channel.image : undefined)} color={contact?.color} size={40} />
        <span className="workspace-home__row-copy"><strong>{name}</strong><span className="calls-view__status">{missed ? <PhoneMissed size={13} strokeWidth={1.75} aria-hidden="true" /> : outgoing ? <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" /> : <ArrowDownLeft size={13} strokeWidth={1.75} aria-hidden="true" />}{missed ? t("chat.missedCall") : t("chat.callLog", { duration: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` })}</span></span>
        <span className="calls-view__meta"><time dateTime={message.timestamp}>{new Date(message.timestamp).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" })}</time><Phone className="calls-view__type-icon" size={16} strokeWidth={1.75} aria-hidden="true" /></span>
      </button>;
    })}</div>
    {more && <button type="button" className="calls-view__more" disabled={busy} onClick={() => void load()}>{t("chat.calls.loadOlder")}</button>}
  </section>;
}
