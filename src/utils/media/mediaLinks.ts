// mediaLinks.ts
// Czy treść to sam GIF/obraz (wklejka) vs tekst z URL.
// Zakres:
//  - extract + isOnlyExternalMedia
//  - czy treść to sam GIF/obraz vs tekst z URL
// Wklejka Giphy nie idzie uploadem pliku.
// Przy zmianach: MessageInput.tsx, ExternalMedia.tsx.

import { safeHttpsHref } from "../chat/format";
import { extractHttpsUrls } from "../chat/embeds";
import { isOwnCdnHost } from "./allowedMedia";

export type ExternalMediaKind = "gif" | "image";

export interface ExternalMediaLink {
  url: string;
  kind: ExternalMediaKind;
  fileType: string;
  fileName: string;
}

const TRUSTED_IMAGE_HOSTS = new Set([
  "media.giphy.com",
  "i.giphy.com",
  "cdn.klovy.chat",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "i.imgur.com",
  "media.tenor.com",
  "images.unsplash.com",
  "raw.githubusercontent.com",
]);

function configuredCdnHost(): string | null {
  const raw = import.meta.env.VITE_CDN_BASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function fileNameFromUrl(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean).pop();
  if (segment && segment.includes(".")) return segment;
  return url.hostname.replace(/^www\./, "");
}

function classifyExternalMediaUrl(raw: string): ExternalMediaLink | null {
  const safe = safeHttpsHref(raw);
  if (!safe) return null;

  let parsed: URL;
  try {
    parsed = new URL(safe);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (isOwnCdnHost(host)) {
    return null;
  }
  const pathAndQuery = `${parsed.pathname}${parsed.search}`;
  const isGif = /\.gif(?:[?#]|$)/i.test(pathAndQuery);
  const trustedHost =
    TRUSTED_IMAGE_HOSTS.has(host) ||
    host.endsWith(".giphy.com") ||
    host === configuredCdnHost();
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (!trustedHost || segments.length === 0) {
    return null;
  }

  const fileName = fileNameFromUrl(parsed);
  const kind: ExternalMediaKind = isGif ? "gif" : "image";
  const fileType = isGif
    ? "image/gif"
    : /\.png(?:[?#]|$)/i.test(pathAndQuery)
      ? "image/png"
      : /\.webp(?:[?#]|$)/i.test(pathAndQuery)
        ? "image/webp"
        : "image/jpeg";

  return { url: safe, kind, fileType, fileName };
}

export function isAllowedExternalMediaLink(url: string): boolean {
  return classifyExternalMediaUrl(url) != null;
}

export function extractExternalMediaLinks(content: string): ExternalMediaLink[] {
  const links: ExternalMediaLink[] = [];
  const seen = new Set<string>();

  for (const url of extractHttpsUrls(content)) {
    const media = classifyExternalMediaUrl(url);
    if (!media || seen.has(media.url)) continue;
    seen.add(media.url);
    links.push(media);
  }

  return links;
}

export function resolveSingleExternalMediaSend(
  content: string,
): ExternalMediaLink | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const media = classifyExternalMediaUrl(trimmed);
  if (!media) return null;

  if (trimmed !== media.url) return null;
  return media;
}

export function isOnlyExternalMediaContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const media = extractExternalMediaLinks(trimmed);
  if (media.length === 0) return false;

  let remainder = trimmed;
  for (const item of media) {
    remainder = remainder.split(item.url).join("");
  }

  return remainder.trim() === "";
}
