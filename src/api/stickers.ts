import { apiRequest } from "./client";
import type { AppLocale } from "../languages";

export interface StickerItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

export function searchStickers(query: string, limit = 24, lang?: AppLocale) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (lang) params.set("lang", lang);
  return apiRequest<{ stickers: StickerItem[] }>(
    `/api/stickers/search?${params}`,
  );
}

export function trendingStickers(limit = 24, lang?: AppLocale) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (lang) params.set("lang", lang);
  return apiRequest<{ stickers: StickerItem[] }>(
    `/api/stickers/trending?${params}`,
  );
}
