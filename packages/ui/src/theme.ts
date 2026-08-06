export function applyVendorTheme(color?: string | null) {
  const hex = normalizeHex(color || '#10b981');
  const root = document.documentElement;
  root.style.setProperty('--store-theme', hex);
  root.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.14));
  root.style.setProperty('--store-theme-muted', hexToRgba(hex, 0.22));
  root.style.setProperty('--store-theme-overlay', hexToRgba(hex, 0.78));
  root.style.setProperty('--store-theme-overlay-mid', hexToRgba(hex, 0.32));
  root.style.setProperty('--store-theme-overlay-light', hexToRgba(hex, 0.1));
  root.setAttribute('data-store-theme', hex);
  document.body?.classList.add('store-themed');
  return hex;
}

export function normalizeHex(color: string): string {
  const c = String(color || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return (`#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`).toLowerCase();
  }
  return '#10b981';
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex).slice(1);
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}
