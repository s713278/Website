import type { StoreTheme } from '@/modules/storefront/types'

export type ThemePreset = { id: string; label: string; color: string }

export const DEFAULT_PRIMARY_COLOR = '#10b981'
export const DEFAULT_ACCENT_COLOR = '#f97316'

export const PRIMARY_PRESETS: ThemePreset[] = [
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'teal', label: 'Teal', color: '#0d9488' },
  { id: 'amber', label: 'Amber', color: '#d97706' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'sky', label: 'Sky', color: '#0284c8' },
  { id: 'forest', label: 'Forest', color: '#166534' },
]

export const ACCENT_PRESETS: ThemePreset[] = [
  { id: 'orange', label: 'Orange', color: '#f97316' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
  { id: 'sky', label: 'Sky', color: '#0ea5e9' },
  { id: 'lime', label: 'Lime', color: '#65a30d' },
]

export function normalizeHex(color: string | undefined | null, fallback = DEFAULT_PRIMARY_COLOR): string {
  const c = String(color || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase()
  }
  return fallback
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function applyTheme(color: string | undefined, root?: HTMLElement): string {
  const hex = normalizeHex(color, DEFAULT_PRIMARY_COLOR)
  const el = root ?? document.documentElement
  el.style.setProperty('--store-theme', hex)
  el.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.14))
  el.style.setProperty('--store-theme-muted', hexToRgba(hex, 0.22))
  el.style.setProperty('--store-theme-overlay', hexToRgba(hex, 0.78))
  el.style.setProperty('--store-theme-overlay-mid', hexToRgba(hex, 0.32))
  el.style.setProperty('--store-theme-overlay-light', hexToRgba(hex, 0.1))
  el.setAttribute('data-store-theme', hex)
  return hex
}

export function applyAccent(color: string | undefined, root?: HTMLElement): string {
  const hex = normalizeHex(color, DEFAULT_ACCENT_COLOR)
  const el = root ?? document.documentElement
  el.style.setProperty('--store-accent', hex)
  el.style.setProperty('--store-accent-soft', hexToRgba(hex, 0.16))
  el.style.setProperty('--store-accent-muted', hexToRgba(hex, 0.28))
  el.setAttribute('data-store-accent', hex)
  return hex
}

export function applyStoreTheme(theme: StoreTheme | undefined, root?: HTMLElement): void {
  applyTheme(theme?.primaryColor, root)
  applyAccent(theme?.accentColor, root)
}
