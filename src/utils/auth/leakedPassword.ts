// leakedPassword.ts
// HIBP k-anonimowość: tylko 5 znaków SHA-1 na sieć.
// Zakres:
//  - reszta porównania lokalnie
//  - HIBP: 5 znaków SHA-1 na sieć, reszta lokalnie
// Nie loguj hasła ani pełnego hasha. Serwer ma analog w leaked_password.rs.
// Przy zmianach: Signup.tsx, validators/leaked_password.rs.

import i18n from "../../i18n/config";

export function passwordBreachMessage(): string {
  return i18n.t("auth.password.breach");
}

export type PasswordBreachCheck = "safe" | "breached" | "unavailable";

async function sha1HexUpper(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

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
