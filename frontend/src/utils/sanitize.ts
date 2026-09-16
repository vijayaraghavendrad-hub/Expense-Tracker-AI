/**
 * Sanitize a color value to prevent XSS via inline styles.
 * Only allows valid hex colors (#RGB, #RRGGBB, #RRGGBBAA).
 */
export function sanitizeColor(color: string | undefined | null, fallback: string = '#71717a'): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}
