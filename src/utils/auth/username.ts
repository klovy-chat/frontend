// username.ts
// Reguły username po stronie klienta.
// Zakres:
//  - znaki, długość
//  - znaki i długość UX; normalizacja jest na BE
// Normalizacja na serwerze może być inna — testuj conflict 409.
// Przy zmianach: validators/username.rs, Signup.tsx.

import i18n from "../../i18n/config";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

export function normalizeUsernameInput(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

export function sanitizeUsernameInput(raw: string): string {
  const withoutAt = raw.trim().replace(/^@+/, "");
  return withoutAt.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
}

export function looksLikeEmailInput(raw: string): boolean {
  return raw.trim().includes("@");
}

export function validateUsernameInput(username: string): string | null {
  const raw = username.trim();
  if (looksLikeEmailInput(raw)) {
    return i18n.t("auth.username.emailNotAllowed");
  }
  const normalized = normalizeUsernameInput(username);
  if (!normalized) {
    return i18n.t("auth.username.required");
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return i18n.t("auth.username.invalid");
  }
  return null;
}
