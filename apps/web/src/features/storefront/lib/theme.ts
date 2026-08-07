/** Apply vendor theme to CSS variables (matches MithraDraft.applyTheme). */
export function applyStoreTheme(hex?: string | null) {
  const color = normalizeHex(hex) || '#10b981';
  const root = document.documentElement;
  root.style.setProperty('--store-theme', color);
  root.style.setProperty('--store-theme-soft', hexToRgba(color, 0.14));
  root.style.setProperty('--store-theme-muted', hexToRgba(color, 0.22));
  return color;
}

export function normalizeHex(color?: string | null): string {
  if (!color) return '';
  const raw = String(color).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '';
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex).slice(1);
  if (h.length !== 6) return `rgba(16,185,129,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function formatMoney(n: number): string {
  return `₹${Math.round(Number.isFinite(n) ? n : 0)}`;
}
