import type { Contact } from "../../types";

function extractUserId(raw: Record<string, unknown>): string {
  const candidate = raw._id ?? raw.id;
  if (candidate == null) return "";
  if (typeof candidate === "string") {
    const s = candidate.trim();
    return /^[a-f0-9]{24}$/i.test(s) ? s : "";
  }
  if (typeof candidate === "object" && candidate !== null) {
    const s = String(candidate);
    return /^[a-f0-9]{24}$/i.test(s) ? s : "";
  }
  const s = String(candidate).trim();
  return /^[a-f0-9]{24}$/i.test(s) ? s : "";
}

/** Normalizuje użytkownika z API (obsługa id / _id i brakujących pól). */
export function mapChannelUser(raw: unknown): Contact | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!/^[a-f0-9]{24}$/i.test(s)) return null;
    return { _id: s, image: null };
  }
  if (typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;
  const _id = extractUserId(r);
  if (!_id) return null;

  return {
    _id,
    username: typeof r.username === "string" ? r.username : undefined,
    displayName:
      typeof r.displayName === "string"
        ? r.displayName
        : r.displayName === null
          ? null
          : undefined,
    image:
      typeof r.image === "string"
        ? r.image
        : r.image === null
          ? null
          : null,
    color: typeof r.color === "number" ? r.color : undefined,
    bio: typeof r.bio === "string" ? r.bio : r.bio === null ? null : undefined,
    isBot: r.isBot === true,
  };
}

export function mapChannelUserList(raw: unknown[] | undefined): Contact[] {
  if (!raw?.length) return [];
  return raw
    .map((item) => mapChannelUser(item))
    .filter((u): u is Contact => u != null);
}
