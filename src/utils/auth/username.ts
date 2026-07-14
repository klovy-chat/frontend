import i18n from "../../i18n/config";

const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

/** Normalizuje login — usuwa spacje, @ na początku i zamienia na małe litery. */
export function normalizeUsernameInput(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
}

/** Ogranicza wpisywanie do dozwolonych znaków nazwy użytkownika (bez e-maila). */
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
