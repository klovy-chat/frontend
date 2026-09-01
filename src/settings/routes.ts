// routes.ts
// Mapa sekcji PL → slug URL EN.
// Zakres:
//  - parse i budowa ścieżki /settings/...
//  - slug EN w URL ↔ nazwa sekcji PL
// Bez wpisu tu Panel nie otworzy zakładki z linku.
// Przy zmianach: Settings.tsx, Panel.tsx.

export type SettingsSection =
  | "profil"
  | "konto"
  | "status"
  | "sesje"
  | "glos"
  | "jezyk"
  | "ostrzezenia";

export const SECTION_SLUGS: Record<SettingsSection, string> = {
  profil: "profile",
  konto: "account",
  status: "status",
  sesje: "sessions",
  glos: "voice",
  jezyk: "language",
  ostrzezenia: "warnings",
};

const SLUG_TO_SECTION = Object.fromEntries(
  Object.entries(SECTION_SLUGS).map(([section, slug]) => [slug, section]),
) as Record<string, SettingsSection>;

export const DEFAULT_SETTINGS_SECTION: SettingsSection = "konto";

export function settingsPath(section: SettingsSection = DEFAULT_SETTINGS_SECTION): string {
  return `/settings/${SECTION_SLUGS[section]}`;
}

export function parseSettingsSection(slug?: string | null): SettingsSection | null {
  if (!slug) return null;
  return SLUG_TO_SECTION[slug] ?? null;
}
