import { safeHttpsHref } from "./messageFormat";
import { isAllowedExternalMediaLink } from "../media/externalMediaLinks";

const URL_REGEX = /https:\/\/[^\s<>"'`]*[^\s<>"'`.,!?:;)\]}]/g;
const MAX_EMBEDS_PER_MESSAGE = 2;

const SKIP_HOSTS = new Set([
  "cdn.klovy.chat",
  "media.giphy.com",
  "i.giphy.com",
]);

export type LinkEmbedKind = "iframe" | "card";

export interface ResolvedLinkEmbed {
  kind: LinkEmbedKind;
  url: string;
  provider: string;
  iframeSrc?: string;
  aspectRatio?: string;
  height?: number;
}

export interface LinkPreviewCard {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export function extractHttpsUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const raw of matches) {
    const safe = safeHttpsHref(raw);
    if (!safe || seen.has(safe)) continue;
    seen.add(safe);
    urls.push(safe);
  }

  return urls;
}

function hostName(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function shouldSkipUrl(url: URL): boolean {
  const host = hostName(url);
  if (SKIP_HOSTS.has(host)) return true;
  if (host.endsWith(".giphy.com")) return true;
  if (isAllowedExternalMediaLink(url.toString())) return true;
  return false;
}

function twitchParent(): string {
  if (typeof window === "undefined") return "klovy.chat";
  return window.location.hostname || "klovy.chat";
}

function parseYouTube(url: URL): ResolvedLinkEmbed | null {
  const host = hostName(url);
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] ?? null;
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] ?? null;
    } else if (url.pathname.startsWith("/live/")) {
      videoId = url.pathname.split("/")[2] ?? null;
    }
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

  return {
    kind: "iframe",
    url: url.toString(),
    provider: "youtube",
    iframeSrc: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
    aspectRatio: "16 / 9",
  };
}

function parseVimeo(url: URL): ResolvedLinkEmbed | null {
  if (hostName(url) !== "vimeo.com") return null;
  const videoId = url.pathname.match(/^\/(\d+)/)?.[1];
  if (!videoId) return null;

  return {
    kind: "iframe",
    url: url.toString(),
    provider: "vimeo",
    iframeSrc: `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`,
    aspectRatio: "16 / 9",
  };
}

function parseSpotify(url: URL): ResolvedLinkEmbed | null {
  if (hostName(url) !== "open.spotify.com") return null;
  const match = url.pathname.match(/^\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (!match) return null;

  const [, type, id] = match;
  const tallTypes = new Set(["album", "playlist", "show"]);
  return {
    kind: "iframe",
    url: url.toString(),
    provider: "spotify",
    iframeSrc: `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`,
    height: tallTypes.has(type) ? 352 : 152,
  };
}

function parseTwitch(url: URL): ResolvedLinkEmbed | null {
  const host = hostName(url);
  const parent = encodeURIComponent(twitchParent());
  let iframeSrc: string | null = null;

  if (host === "clips.twitch.tv") {
    const clip = url.pathname.split("/").filter(Boolean)[0];
    if (clip) {
      iframeSrc = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${parent}`;
    }
  } else if (host === "twitch.tv") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "videos" && parts[1]) {
      iframeSrc = `https://player.twitch.tv/?video=${encodeURIComponent(parts[1])}&parent=${parent}`;
    } else if (parts.length === 1 && parts[0] !== "directory") {
      iframeSrc = `https://player.twitch.tv/?channel=${encodeURIComponent(parts[0])}&parent=${parent}`;
    }
  }

  if (!iframeSrc) return null;

  return {
    kind: "iframe",
    url: url.toString(),
    provider: "twitch",
    iframeSrc,
    aspectRatio: "16 / 9",
  };
}

function parseTikTok(url: URL): ResolvedLinkEmbed | null {
  const host = hostName(url);
  if (host !== "tiktok.com" && host !== "vm.tiktok.com") return null;

  const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  return {
    kind: "iframe",
    url: url.toString(),
    provider: "tiktok",
    iframeSrc: `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}`,
    aspectRatio: "9 / 16",
  };
}

function parseSoundCloud(url: URL): ResolvedLinkEmbed | null {
  if (hostName(url) !== "soundcloud.com") return null;
  if (url.pathname.split("/").filter(Boolean).length < 2) return null;

  return {
    kind: "iframe",
    url: url.toString(),
    provider: "soundcloud",
    iframeSrc: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}&color=%237c5cff`,
    height: 166,
  };
}

function resolveKnownEmbed(url: URL): ResolvedLinkEmbed | null {
  return (
    parseYouTube(url)
    ?? parseVimeo(url)
    ?? parseSpotify(url)
    ?? parseTwitch(url)
    ?? parseTikTok(url)
    ?? parseSoundCloud(url)
  );
}

export function resolveMessageLinkEmbeds(content: string): {
  iframes: ResolvedLinkEmbed[];
  cardUrls: string[];
} {
  const iframes: ResolvedLinkEmbed[] = [];
  const cardUrls: string[] = [];
  const seen = new Set<string>();

  for (const raw of extractHttpsUrls(content)) {
    if (iframes.length + cardUrls.length >= MAX_EMBEDS_PER_MESSAGE) break;

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }

    if (shouldSkipUrl(parsed)) continue;

    const known = resolveKnownEmbed(parsed);
    if (known) {
      if (!seen.has(known.url)) {
        seen.add(known.url);
        iframes.push(known);
      }
      continue;
    }

    if (!seen.has(raw)) {
      seen.add(raw);
      cardUrls.push(raw);
    }
  }

  return {
    iframes,
    cardUrls: cardUrls.slice(0, Math.max(0, MAX_EMBEDS_PER_MESSAGE - iframes.length)),
  };
}
