import i18n from "../../i18n/config";

export function normalizeAuthError(
  message: string,
  context: "login" | "signup" | "admin",
): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return context === "admin"
      ? i18n.t("auth.errors.invalidAdminLogin")
      : i18n.t("auth.errors.invalidLogin");
  }

  const lower = trimmed.toLowerCase();

  if (context === "signup") {
    if (lower.includes("password") && lower.includes("breach")) {
      return trimmed;
    }
    if (lower.includes("captcha") || lower.includes("turnstile")) {
      return trimmed;
    }
    if (lower.includes("whitelist") || lower.includes("aktyw")) {
      return trimmed;
    }
    return trimmed;
  }

  if (
    lower.includes("captcha") ||
    lower.includes("turnstile") ||
    lower.includes("two-factor") ||
    lower.includes("2fa") ||
    lower.includes("csrf") ||
    lower.includes("too many")
  ) {
    return trimmed;
  }

  if (
    lower.includes("invalid credentials") ||
    lower.includes("username") ||
    lower.includes("password") ||
    lower.includes("login") ||
    lower.includes("hasło") ||
    lower.includes("użytkownik") ||
    lower.includes("nieprawidłow")
  ) {
    return context === "admin"
      ? i18n.t("auth.errors.invalidAdminLogin")
      : i18n.t("auth.errors.invalidLogin");
  }

  return trimmed;
}
