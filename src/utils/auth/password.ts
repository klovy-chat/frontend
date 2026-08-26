// password.ts
// Reguły siły hasła na kliencie (długość itd.).
// Zakres:
//  - signup i zmiana hasła
//  - długość/siła na kliencie; serwer i tak sprawdzi
// Serwer i tak waliduje — to tylko UX. Zmiana: też auth/validation.rs.
// Przy zmianach: Signup.tsx, Panel.tsx, utils/auth/validation.rs.

import i18n from "../../i18n/config";

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return i18n.t("auth.password.minLength");
  }
  if (!/[a-z]/.test(password)) {
    return i18n.t("auth.password.lowercase");
  }
  if (!/[A-Z]/.test(password)) {
    return i18n.t("auth.password.uppercase");
  }
  if (!/[0-9]/.test(password)) {
    return i18n.t("auth.password.digit");
  }
  if (!/[@$!%*?&]/.test(password)) {
    return i18n.t("auth.password.special");
  }
  return null;
}
