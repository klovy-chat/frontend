import { useEffect, useRef, useState } from "react";
import { Download, File, Play, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getMessages } from "../../api/messages";
import { getChannelMessages } from "../../api/channels";
import { MediaImage } from "../common/MediaImage";
import { Lightbox } from "../chat/Lightbox";
import { VideoPlayer } from "../chat/VideoPlayer";
import { downloadMediaFile, resolveChatImagePreviewUrl } from "../../utils/media/media";
import { isVideoAttachment } from "../../utils/media/attachments";
import type { ChatTarget, Message } from "../../types";
import "../../styles/chat/conversation-media.css";

export function ConversationMedia({ target }: { target: ChatTarget }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState<Message | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const cursor = useRef<string>();
  const controller = useRef<AbortController>();
  const scope = `${target.type}:${target.type === "dm" ? target.contact._id : target.channel._id}`;

  async function load(reset = false) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (reset) { cursor.current = undefined; setFiles([]); setPreview(null); setMore(false); }
    setBusy(true); setError(false);
    try {
      const opts = { before: cursor.current, limit: 100, signal: abort.signal };
      const page = target.type === "dm" ? await getMessages(target.contact._id, opts) : await getChannelMessages(target.channel._id, opts);
      if (abort.signal.aborted) return;
      const attachments = page.messages.filter(m => m.fileUrl && !m.deleted && m.scanStatus !== "blocked" && m.scanStatus !== "pending");
      setFiles(previous => Array.from(new Map([...previous, ...attachments].map(m => [m._id, m])).values()).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
      const oldest = [...page.messages].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
      setMore(!!oldest && oldest._id !== cursor.current && (page.hasMore ?? page.messages.length >= 100));
      cursor.current = oldest?._id;
    } catch { if (!abort.signal.aborted) setError(true); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  useEffect(() => { void load(true); return () => controller.current?.abort(); }, [scope]);
  useEffect(() => {
    if (!preview || !isVideoAttachment(preview)) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPreview(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [preview]);

  async function download(message: Message) {
    if (!message.fileUrl || downloading) return;
    setDownloading(message._id);
    try { await downloadMediaFile(message.fileUrl, message.fileName || "attachment"); }
    catch { setError(true); }
    finally { setDownloading(null); }
  }
  const images = files.filter(m => m.messageType === "IMAGE" || m.fileType?.startsWith("image/"));
  const visuals = files.filter(m => images.includes(m) || isVideoAttachment(m));
  const documents = files.filter(m => !visuals.includes(m));
  return <section className="conversation-details__section conversation-media">
    <header><h3>{t("chat.media.title")}</h3><button type="button" disabled={busy} onClick={() => void load(true)} aria-label={t("chat.media.refresh")}><RefreshCw size={14} /></button></header>
    {busy && <p role="status">{t("chat.media.loading")}</p>}
    {error && <p role="alert">{t("chat.media.error")}</p>}
    {!busy && !error && files.length === 0 && <p className="conversation-media__empty">{t("chat.media.empty")}</p>}
    <div className="conversation-media__grid">{visuals.map(message => <button type="button" key={message._id} className="conversation-media__thumbnail" onClick={() => setPreview(message)} aria-label={message.fileName || t("chat.media.preview")}>
      {isVideoAttachment(message) ? <><Play size={24} /><span>{message.fileName || t("chat.media.video")}</span></> : <MediaImage fileUrl={resolveChatImagePreviewUrl(message.fileUrl!)} fallbackFileUrl={message.fileUrl} alt={message.fileName || ""} loading="lazy" />}
    </button>)}</div>
    <div className="conversation-media__files">{documents.map(message => <button type="button" key={message._id} disabled={downloading !== null} onClick={() => void download(message)}><File size={18} /><span>{message.fileName || t("chat.media.file")}</span><Download size={14} /></button>)}</div>
    {more && <button className="conversation-media__older" type="button" disabled={busy} onClick={() => void load()}>{t("chat.media.older")}</button>}
    {preview && !isVideoAttachment(preview) && <Lightbox items={images.map(m => ({ url: m.fileUrl!, fileName: m.fileName || "image", messageId: m._id }))} initialIndex={Math.max(0, images.findIndex(m => m._id === preview._id))} onClose={() => setPreview(null)} />}
    {preview && isVideoAttachment(preview) && <div className="conversation-media__overlay" onClick={event => { if (event.target === event.currentTarget) setPreview(null); }}><div role="dialog" aria-modal="true" aria-label={preview.fileName || t("chat.media.video")}><button type="button" autoFocus onClick={() => setPreview(null)}>{t("common.close")}</button><VideoPlayer src={preview.fileUrl!} fileType={preview.fileType} fileName={preview.fileName} /><button type="button" disabled={downloading !== null} onClick={() => void download(preview)}><Download size={16} />{t("chat.media.download")}</button></div></div>}
  </section>;
}
