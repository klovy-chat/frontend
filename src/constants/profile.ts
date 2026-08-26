// profile.ts
// Max długość bio i display name.
// Zakres:
//  - setup profilu i ustawienia
//  - max bio i display name — serwer i tak obetnie
// Trzymaj z validators po stronie serwera.
// Przy zmianach: ProfileFields.tsx, utils/auth/validation.rs.

export const BIO_MAX_LENGTH = 500;
export const DISPLAY_NAME_MAX_LENGTH = 32;
