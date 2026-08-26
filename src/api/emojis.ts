// emojis.ts
// Lista emoji z backendu (bez kluczy zewnętrznych w przeglądarce).
// Zakres:
//  - grupy do pickera
//  - grupy do pickera; klucz zewnętrzny zostaje na serwerze
// Pusta tablica przy błędzie — nie udawaj cache.
// Przy zmianach: pickers/Emoji.tsx, controllers/emojis.rs.

import { apiRequest } from "./client";

interface EmojiItem {
  char: string;
  name: string;
  keywords: string;
}

export interface EmojiGroup {
  name: string;
  slug: string;
  emojis: EmojiItem[];
}

interface EmojiResponse {
  count: number;
  groups: EmojiGroup[];
}

export interface ReactionPickerEmojis {
  quick: string[];
  grid: string[];
}

const REACTION_GROUP_SLUGS = new Set(["smileys_emotion", "people_body"]);

const QUICK_REACTION_KEYWORDS = [
  "thumbs up",
  "red heart",
  "face with tears of joy",
  "face with open mouth",
  "crying face",
  "party popper",
] as const;

let cache: Promise<EmojiGroup[]> | null = null;

export function getEmojis(): Promise<EmojiGroup[]> {
  if (!cache) {
    cache = apiRequest<EmojiResponse>("/api/emojis")
      .then((res) => res.groups)
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

function findEmojiChar(groups: EmojiGroup[], keyword: string): string | null {
  for (const group of groups) {
    for (const emoji of group.emojis) {
      if (emoji.keywords === keyword || emoji.name === keyword) {
        return emoji.char;
      }
    }
  }
  return null;
}

function buildReactionPickerEmojis(groups: EmojiGroup[]): ReactionPickerEmojis {
  const quick: string[] = [];
  const quickSet = new Set<string>();

  for (const keyword of QUICK_REACTION_KEYWORDS) {
    const char = findEmojiChar(groups, keyword);
    if (char && !quickSet.has(char)) {
      quickSet.add(char);
      quick.push(char);
    }
  }

  const grid: string[] = [];
  const seen = new Set<string>(quickSet);

  for (const group of groups) {
    if (!REACTION_GROUP_SLUGS.has(group.slug)) continue;
    for (const emoji of group.emojis) {
      if (seen.has(emoji.char)) continue;
      seen.add(emoji.char);
      grid.push(emoji.char);
    }
  }

  return { quick, grid };
}

export function getReactionPickerEmojis(): Promise<ReactionPickerEmojis> {
  return getEmojis().then(buildReactionPickerEmojis);
}
