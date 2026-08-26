// gifs.ts
// Szukaj GIF: Giphy wyłącznie przez nasz backend.
// Zakres:
//  - wynik to URL wklejany jako external media
//  - query → URL wklejany jako external media, nie upload
// Klucz Giphy tylko w .env serwera.
// Przy zmianach: pickers/Gif.tsx, controllers/gifs.rs.

import { apiRequest } from "./client";
import type { AppLocale } from "../languages";

export interface GifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

export function searchGifs(query: string, limit = 24, lang?: AppLocale) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (lang) params.set("lang", lang);
  return apiRequest<{ gifs: GifItem[] }>(`/api/gifs/search?${params}`);
}

export function trendingGifs(limit = 24, lang?: AppLocale) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (lang) params.set("lang", lang);
  return apiRequest<{ gifs: GifItem[] }>(`/api/gifs/trending?${params}`);
}
