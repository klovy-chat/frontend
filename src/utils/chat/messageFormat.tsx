import { Fragment, type ReactNode } from "react";
import type { MessageUser } from "../../types";
import { getUserId } from "../user/format";

/**
 * Lekkie formatowanie wiadomości w stylu Markdown.
 * Obsługiwane znaczniki:
 *   **pogrubienie**  __pogrubienie__
 *   *kursywa*        _kursywa_
 *   ~~przekreślenie~~
 *   `kod w linii`
 *   ```blok kodu```
 *   @wzmianki (@username, @everyone, @here)
 *
 * Renderowanie odbywa się przez węzły React (nie używamy dangerouslySetInnerHTML),
 * dzięki czemu treść użytkownika jest automatycznie escapowana – brak ryzyka XSS.
 */

interface InlineRule {
  regex: RegExp;
  recurse: boolean;
  render: (inner: ReactNode, key: string) => ReactNode;
}

export interface MentionRenderOptions {
  mentions?: MessageUser[];
  currentUserId?: string;
  /** Czy traktować @everyone / @here jako wzmiankę (kanały). */
  allowEveryone?: boolean;
}

const DISCORD_TIMESTAMP_REGEX = /<t:(\d{1,11})(?::([tTdDfFR]))?>/;

type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

function formatDiscordTimestamp(unixSeconds: number, style: DiscordTimestampStyle): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";

  if (style === "R") {
    const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ["year", 60 * 60 * 24 * 365],
      ["month", 60 * 60 * 24 * 30],
      ["week", 60 * 60 * 24 * 7],
      ["day", 60 * 60 * 24],
      ["hour", 60 * 60],
      ["minute", 60],
      ["second", 1],
    ];
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, seconds] of units) {
      if (abs >= seconds || unit === "second") {
        return rtf.format(Math.round(diffSec / seconds), unit);
      }
    }
  }

  const locale = undefined;
  switch (style) {
    case "t":
      return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
    case "T":
      return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date);
    case "d":
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric" }).format(date);
    case "D":
      return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);
    case "f":
      return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(date);
    case "F":
      return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(date);
    default:
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

/** Split text around Discord `<t:…>` timestamps and render them as localized times. */
function parseDiscordTimestamps(
  text: string,
  keyBase: string,
  rules: InlineRule[],
): ReactNode[] | null {
  if (!DISCORD_TIMESTAMP_REGEX.test(text)) return null;
  DISCORD_TIMESTAMP_REGEX.lastIndex = 0;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = DISCORD_TIMESTAMP_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...parseInlineWithoutTimestamps(
          text.slice(lastIndex, match.index),
          `${keyBase}d${key++}`,
          rules,
        ),
      );
    }
    const unix = Number(match[1]);
    const style = (match[2] ?? "f") as DiscordTimestampStyle;
    const label = formatDiscordTimestamp(unix, style);
    nodes.push(
      <time
        key={`${keyBase}ts${key++}`}
        className="msg-discord-ts"
        dateTime={new Date(unix * 1000).toISOString()}
        title={formatDiscordTimestamp(unix, "F")}
      >
        {label || match[0]}
      </time>,
    );
    lastIndex = DISCORD_TIMESTAMP_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(
      ...parseInlineWithoutTimestamps(
        text.slice(lastIndex),
        `${keyBase}d${key++}`,
        rules,
      ),
    );
  }

  return nodes;
}

const BASE_INLINE_RULES: InlineRule[] = [
  {
    regex: /`([^`\n]+)`/,
    recurse: false,
    render: (inner, key) => (
      <code key={key} className="msg-inline-code">
        {inner}
      </code>
    ),
  },
  {
    // Tylko http(s) — celowo nie linkujemy innych schematów (np. javascript:),
    // a domknięcie wyklucza końcową interpunkcję, by nie wciągać kropek/przecinków.
    regex: /(https:\/\/[^\s<>"'`]*[^\s<>"'`.,!?:;)\]}])/,
    recurse: false,
    render: (inner, key) => {
      const raw = String(inner);
      const safeHref = safeHttpsHref(raw);
      // Jeśli URL nie przejdzie walidacji (np. z danymi logowania), renderuj jako tekst.
      if (!safeHref) {
        return <Fragment key={key}>{raw}</Fragment>;
      }
      return (
        <a
          key={key}
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="msg-link"
        >
          {raw}
        </a>
      );
    },
  },
  {
    regex: /\*\*([\s\S]+?)\*\*/,
    recurse: true,
    render: (inner, key) => <strong key={key}>{inner}</strong>,
  },
  {
    regex: /__([\s\S]+?)__/,
    recurse: true,
    render: (inner, key) => <strong key={key}>{inner}</strong>,
  },
  {
    regex: /~~([\s\S]+?)~~/,
    recurse: true,
    render: (inner, key) => <del key={key}>{inner}</del>,
  },
  {
    regex: /\*(\S(?:[\s\S]*?\S)?)\*/,
    recurse: true,
    render: (inner, key) => <em key={key}>{inner}</em>,
  },
  {
    regex: /_(\S(?:[\s\S]*?\S)?)_/,
    recurse: true,
    render: (inner, key) => <em key={key}>{inner}</em>,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Waliduje dopasowany URL przez parser `URL`: dopuszcza wyłącznie schemat
 * `https:` i odrzuca osadzone dane logowania (`https://user:pass@host`),
 * które bywają wykorzystywane do phishingu/mylenia hosta.
 */
export function safeHttpsHref(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const SPECIAL_MENTIONS = ["everyone", "here"];

/** Tworzy regułę inline dla wzmianek na podstawie listy znanych użytkowników. */
function buildMentionRule(options: MentionRenderOptions): InlineRule | null {
  const map = new Map<string, MessageUser>();
  for (const user of options.mentions ?? []) {
    if (user?.username) map.set(user.username.toLowerCase(), user);
  }

  const names = [...map.keys()];
  if (options.allowEveryone) names.push(...SPECIAL_MENTIONS);
  if (names.length === 0) return null;

  // Najdłuższe najpierw, aby uniknąć częściowych dopasowań (np. @joh w @john).
  const alternatives = names
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  const regex = new RegExp(
    `(?<![A-Za-z0-9_@])@(${alternatives})(?![a-z0-9_])`,
    "i",
  );

  return {
    regex,
    recurse: false,
    render: (inner, key) => {
      const raw = String(inner);
      const lower = raw.toLowerCase();

      if (options.allowEveryone && SPECIAL_MENTIONS.includes(lower)) {
        return (
          <span key={key} className="msg-mention msg-mention--self">
            @{lower}
          </span>
        );
      }

      const user = map.get(lower);
      const label = user
        ? user.displayName?.trim() || user.username || lower
        : lower;
      const isSelf =
        Boolean(user) &&
        Boolean(options.currentUserId) &&
        getUserId(user as MessageUser) === options.currentUserId;

      return (
        <span
          key={key}
          className={`msg-mention${isSelf ? " msg-mention--self" : ""}`}
          title={user?.username ? `@${user.username}` : undefined}
        >
          @{label}
        </span>
      );
    },
  };
}

/** Zamienia surowy tekst (bez znaczników) na węzły z zachowaniem łamania linii. */
function renderText(text: string, keyBase: string): ReactNode[] {
  const segments = text.split("\n");
  const nodes: ReactNode[] = [];
  segments.forEach((segment, index) => {
    if (index > 0) nodes.push(<br key={`${keyBase}-br${index}`} />);
    if (segment) {
      nodes.push(<Fragment key={`${keyBase}-s${index}`}>{segment}</Fragment>);
    }
  });
  return nodes;
}

/** Rekurencyjnie parsuje znaczniki inline (pogrubienie, kursywa, kod, wzmianki). */
function parseInlineWithoutTimestamps(
  text: string,
  keyBase: string,
  rules: InlineRule[],
): ReactNode[] {
  if (!text) return [];

  let earliest: { rule: InlineRule; match: RegExpExecArray } | null = null;
  for (const rule of rules) {
    const match = rule.regex.exec(text);
    if (match && (earliest === null || match.index < earliest.match.index)) {
      earliest = { rule, match };
    }
  }

  if (!earliest) return renderText(text, keyBase);

  const { rule, match } = earliest;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const nodes: ReactNode[] = [];

  if (before) nodes.push(...renderText(before, `${keyBase}b`));
  const inner = rule.recurse
    ? parseInline(match[1], `${keyBase}i`, rules)
    : match[1];
  nodes.push(rule.render(inner, `${keyBase}m`));
  if (after) nodes.push(...parseInline(after, `${keyBase}a`, rules));

  return nodes;
}

function parseInline(
  text: string,
  keyBase: string,
  rules: InlineRule[],
): ReactNode[] {
  if (!text) return [];

  const discordNodes = parseDiscordTimestamps(text, keyBase, rules);
  if (discordNodes) return discordNodes;

  return parseInlineWithoutTimestamps(text, keyBase, rules);
}

const CODE_BLOCK_REGEX = /```([\s\S]*?)```/g;

/** Renderuje treść wiadomości z formatowaniem do węzłów React. */
export function renderFormattedText(
  text: string | undefined | null,
  options?: MentionRenderOptions,
): ReactNode {
  if (!text) return text ?? "";

  const mentionRule = options ? buildMentionRule(options) : null;
  const rules = mentionRule
    ? [mentionRule, ...BASE_INLINE_RULES]
    : BASE_INLINE_RULES;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  CODE_BLOCK_REGEX.lastIndex = 0;
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...parseInline(text.slice(lastIndex, match.index), `p${key++}`, rules),
      );
    }
    const code = match[1].replace(/^\n/, "").replace(/\n+$/, "");
    nodes.push(
      <pre key={`cb${key++}`} className="msg-codeblock">
        <code>{code}</code>
      </pre>,
    );
    lastIndex = CODE_BLOCK_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...parseInline(text.slice(lastIndex), `p${key++}`, rules));
  }

  return nodes;
}

/** Usuwa znaczniki formatowania – używane w podglądach (cytaty, lista wyników). */
export function stripFormatting(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/```([\s\S]*?)```/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/\*(\S(?:[\s\S]*?\S)?)\*/g, "$1")
    .replace(/_(\S(?:[\s\S]*?\S)?)_/g, "$1");
}
