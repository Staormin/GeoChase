export const DRAWING_PALETTE = [
  '#6366F1',
  '#8B5CF6',
  '#2563EB',
  '#0891B2',
  '#059669',
  '#65A30D',
  '#D97706',
  '#EA580C',
  '#DC2626',
  '#DB2777',
  '#475569',
  '#000000',
];
const STORAGE_KEY = 'geochase_recentDrawingColors';
export function isDrawingColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
}

export function getRecentDrawingColors(): string[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(values)
      ? [...new Set(values.filter(isDrawingColor).map((value) => value.toUpperCase()))].slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export function rememberDrawingColor(color: string): void {
  if (!isDrawingColor(color)) return;
  const normalized = color.toUpperCase();
  const colors = [normalized, ...getRecentDrawingColors().filter((item) => item !== normalized)];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors.slice(0, 8)));
  } catch {
    // The drawing can still be recolored when browser storage is unavailable.
  }
}
