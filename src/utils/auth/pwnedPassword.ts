import i18n from "../../i18n/config";

export function passwordBreachMessage(): string {
  return i18n.t("auth.password.breach");
}

/** Prefer {@link passwordBreachMessage} for locale-aware text. */
export const PASSWORD_BREACH_MESSAGE = passwordBreachMessage();

export type PasswordBreachCheck = "safe" | "breached" | "unavailable";

async function sha1HexUpper(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/** Have I Been Pwned — k-anonymity (tylko pierwsze 5 znaków hasha SHA-1). */
export async function checkPasswordBreach(
  password: string,
): Promise<PasswordBreachCheck> {
  if (!password) return "safe";

  try {
    const hash = await sha1HexUpper(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          "Add-Padding": "true",
        },
      },
    );

    if (!response.ok) {
      return "unavailable";
    }

    const body = await response.text();
    const breached = body.split("\n").some((line) => {
      const [hashSuffix] = line.split(":");
      return hashSuffix?.trim().toUpperCase() === suffix;
    });

    return breached ? "breached" : "safe";
  } catch {
    return "unavailable";
  }
}

export function isPasswordBreachError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("wycieku") ||
    lower.includes("breach") ||
    lower.includes("pwned")
  );
}
