const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeBadgeColor(color?: string | null): string {
  const trimmed = color?.trim();
  if (trimmed && HEX_COLOR.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return "#8B5CF6";
}

export function isValidBadgeColor(color: string): boolean {
  return HEX_COLOR.test(color.trim());
}

export function isValidBadgeIcon(icon: string): boolean {
  return /^[A-Z][A-Za-z0-9]{0,63}$/.test(icon.trim());
}
