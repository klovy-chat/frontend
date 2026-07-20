import { useEffect, useMemo, useState } from "react";
import { fetchLinkPreview } from "../../api/messages";
import { safeHttpsHref } from "../../utils/chat/messageFormat";
import {
  resolveMessageLinkEmbeds,
  type LinkPreviewCard,
  type ResolvedLinkEmbed,
} from "../../utils/chat/linkEmbeds";
import { ChannelInviteEmbed } from "./ChannelInviteEmbed";
import "../../styles/chat/link-embed.css";

const previewCache = new Map<string, LinkPreviewCard>();
const previewInflight = new Map<string, Promise<LinkPreviewCard | null>>();

function safePreviewImage(url?: string): string | undefined {
  if (!url) return undefined;
  return safeHttpsHref(url) ?? undefined;
}

function hostnameLabel(url: string, siteName?: string): string {
  if (siteName?.trim()) return siteName.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function loadPreview(url: string): Promise<LinkPreviewCard | null> {
  const cached = previewCache.get(url);
  if (cached) return cached;

  const inflight = previewInflight.get(url);
  if (inflight) return inflight;

  const request = fetchLinkPreview(url)
    .then((preview) => {
      previewCache.set(url, preview);
      return preview;
    })
    .catch(() => null)
    .finally(() => {
      previewInflight.delete(url);
    });

  previewInflight.set(url, request);
  return request;
}

function LinkEmbedIframe({ embed }: { embed: ResolvedLinkEmbed }) {
  const style = embed.height
    ? { height: `${embed.height}px` }
    : { aspectRatio: embed.aspectRatio ?? "16 / 9" };

  return (
    <div className="message-link-embed message-link-embed--iframe">
      <div className="message-link-embed__frame" style={style}>
        <iframe
          src={embed.iframeSrc}
          title={embed.provider}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

function LinkEmbedCard({ preview }: { preview: LinkPreviewCard }) {
  const image = safePreviewImage(preview.image);
  const title = preview.title?.trim() || hostnameLabel(preview.url, preview.siteName);
  const description = preview.description?.trim();
  const siteLabel = hostnameLabel(preview.url, preview.siteName);

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="message-link-embed message-link-embed--card"
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="message-link-embed__image"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <div className="message-link-embed__body">
        <span className="message-link-embed__site">{siteLabel}</span>
        <span className="message-link-embed__title">{title}</span>
        {description ? (
          <span className="message-link-embed__description">{description}</span>
        ) : null}
      </div>
    </a>
  );
}

interface MessageLinkEmbedsProps {
  content: string;
}

export function MessageLinkEmbeds({ content }: MessageLinkEmbedsProps) {
  const { inviteLinks, iframes, cardUrls } = useMemo(
    () => resolveMessageLinkEmbeds(content),
    [content],
  );
  const [cards, setCards] = useState<LinkPreviewCard[]>([]);

  useEffect(() => {
    if (cardUrls.length === 0) {
      setCards([]);
      return;
    }

    let cancelled = false;
    setCards([]);

    void (async () => {
      const loaded: LinkPreviewCard[] = [];
      for (const url of cardUrls) {
        const preview = await loadPreview(url);
        if (cancelled) return;
        if (preview && (preview.title || preview.description || preview.image)) {
          loaded.push(preview);
        }
      }
      if (!cancelled) {
        setCards(loaded);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cardUrls]);

  if (inviteLinks.length === 0 && iframes.length === 0 && cards.length === 0) {
    return null;
  }

  return (
    <div className="message-link-embeds">
      {inviteLinks.map((link) => (
        <ChannelInviteEmbed key={link.inviteId} link={link} />
      ))}
      {iframes.map((embed) => (
        <LinkEmbedIframe key={embed.url} embed={embed} />
      ))}
      {cards.map((preview) => (
        <LinkEmbedCard key={preview.url} preview={preview} />
      ))}
    </div>
  );
}
