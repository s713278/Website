import type { StoreTheme } from '@/modules/storefront/types'
import { ensureFontLoaded } from './fonts'

export type ThemePreset = { id: string; label: string; color: string }

export type BgPreset = ThemePreset & { mode: 'light' | 'dark' }

export type FontPreset = {
  /** Internal slug, exposed as data-store-font. */
  id: string
  /** The wire value — exact CSS/Google family name, e.g. "DM Sans". */
  family: string
  label: string
  hint: string
  display: string
  body: string
  /** ':wght@...' spec used when requesting the family from Google Fonts. */
  weights: string
  /** Shipped in index.html — skip dynamic injection. */
  alreadyLoaded?: boolean
}

export const DEFAULT_PRIMARY_COLOR = '#10b981'
export const DEFAULT_ACCENT_COLOR = '#f97316'
export const DEFAULT_BG = '#f9fafb'
export const DEFAULT_FONT = 'poppins'

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

/**
 * Curated storefront backgrounds. Vendors pick from these only (no custom hex) so every
 * option is hand-tuned and no value can land in a mid-tone where neither ink set reads.
 * `mode` is declared rather than inferred — see resolveBgMode.
 */
export const BG_PRESETS: BgPreset[] = [
  { id: 'white', label: 'White', color: '#ffffff', mode: 'light' },
  { id: 'soft', label: 'Soft gray', color: '#f9fafb', mode: 'light' },
  { id: 'mint', label: 'Mint', color: '#f0fdf4', mode: 'light' },
  { id: 'sky', label: 'Sky mist', color: '#f0f9ff', mode: 'light' },
  { id: 'sand', label: 'Warm sand', color: '#faf6f1', mode: 'light' },
  { id: 'ink', label: 'Charcoal', color: '#111827', mode: 'dark' },
  { id: 'slate', label: 'Slate', color: '#0f172a', mode: 'dark' },
  { id: 'forest', label: 'Deep forest', color: '#0c1f1a', mode: 'dark' },
  { id: 'plum', label: 'Deep plum', color: '#1a1425', mode: 'dark' },
]

/**
 * Curated font pairings. Chosen to read clean, legible and professional.
 * `family` is what the API's `font_family` matches against.
 */
export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'poppins',
    family: 'Poppins',
    label: 'Poppins',
    hint: 'Default',
    display: "'Poppins', 'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    weights: '400;500;600;700;800',
  },
  {
    id: 'inter',
    family: 'Inter',
    label: 'Inter',
    hint: 'Neutral',
    display: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    weights: '400;500;600;700',
    alreadyLoaded: true,
  },
  {
    id: 'outfit',
    family: 'Outfit',
    label: 'Outfit',
    hint: 'Modern',
    display: "'Outfit', system-ui, sans-serif",
    body: "'Outfit', system-ui, sans-serif",
    weights: '400;500;600;700;800',
  },
  {
    id: 'dm-sans',
    family: 'DM Sans',
    label: 'DM Sans',
    hint: 'Clean',
    display: "'DM Sans', system-ui, sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    // DM Sans has no 800 weight — requesting it makes Google 400 the whole stylesheet.
    weights: '400;500;600;700',
  },
  {
    id: 'source-sans',
    family: 'Source Sans 3',
    label: 'Source Sans',
    hint: 'Classic',
    display: "'Source Sans 3', system-ui, sans-serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    weights: '400;500;600;700;800',
  },
  {
    id: 'lora',
    family: 'Lora',
    label: 'Lora',
    hint: 'Editorial',
    // Serif display over a sans body — a serif at 14px body copy hurts legibility.
    display: "'Lora', Georgia, serif",
    body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    weights: '400;500;600;700',
  },
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

/**
 * YIQ perceived brightness on raw 0-255 sRGB, with no gamma linearization.
 * Range is 0-255 — this is NOT WCAG relative luminance (which is 0-1).
 */
export function perceivedBrightness(hex: string): number {
  const h = normalizeHex(hex).slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000
}

/** Single decision boundary — no dead zone, so every colour classifies. */
export function isDarkBackground(hex: string): boolean {
  return perceivedBrightness(hex) < 170
}

export function getBgPreset(color: string | undefined | null): BgPreset {
  const hex = normalizeHex(color, DEFAULT_BG)
  const found = BG_PRESETS.find((preset) => preset.color === hex)
  return found ?? BG_PRESETS.find((preset) => preset.color === DEFAULT_BG) ?? BG_PRESETS[0]
}

/** Curated-only enforcement point: anything off-list resolves to the default swatch. */
export function resolveBgHex(color: string | undefined | null): string {
  return getBgPreset(color).color
}

/**
 * Resolves the API's `font_family` (a CSS family name like "DM Sans") to a preset.
 * Falls back to matching on `id` so an internal slug also works. Always returns a preset.
 */
export function getFontPreset(fontFamily: string | undefined | null): FontPreset {
  const value = String(fontFamily || '').trim().toLowerCase()
  const fallback =
    FONT_PRESETS.find((preset) => preset.id === DEFAULT_FONT) ?? FONT_PRESETS[0]
  if (!value) return fallback
  return (
    FONT_PRESETS.find((preset) => preset.family.toLowerCase() === value) ??
    FONT_PRESETS.find((preset) => preset.id === value) ??
    fallback
  )
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
  // Primary doubles as the storefront button colour, and vendors may pick any hex —
  // compute the foreground so white text can't end up on a pale primary.
  el.style.setProperty('--primary-foreground', isDarkBackground(hex) ? '#ffffff' : '#111827')
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

/**
 * Sets the canvas colour and the light/dark flag. The per-mode token sets themselves live
 * in global.css under [data-store-mode] so both palettes stay reviewable in one place.
 */
export function applyBackground(color: string | undefined, root?: HTMLElement): 'light' | 'dark' {
  const preset = getBgPreset(color)
  const el = root ?? document.documentElement
  el.style.setProperty('--store-bg', preset.color)
  el.setAttribute('data-store-bg', preset.color)
  el.setAttribute('data-store-mode', preset.mode)
  return preset.mode
}

export function applyFont(fontFamily: string | undefined, root?: HTMLElement): FontPreset {
  const preset = getFontPreset(fontFamily)
  const el = root ?? document.documentElement
  // Shadows the :root defaults for this subtree only — .font-display is used app-wide,
  // so these must never be set on documentElement from a storefront.
  el.style.setProperty('--font-display', preset.display)
  el.style.setProperty('--font-body', preset.body)
  el.setAttribute('data-store-font', preset.id)
  ensureFontLoaded(preset)
  return preset
}

export function applyStoreTheme(theme: StoreTheme | undefined, root?: HTMLElement): void {
  applyTheme(theme?.primaryColor, root)
  applyAccent(theme?.accentColor, root)
  applyBackground(theme?.backgroundColor, root)
  applyFont(theme?.fontFamily, root)
}

const THEME_PROPERTIES = [
  '--store-theme',
  '--store-theme-soft',
  '--store-theme-muted',
  '--store-theme-overlay',
  '--store-theme-overlay-mid',
  '--store-theme-overlay-light',
  '--store-accent',
  '--store-accent-soft',
  '--store-accent-muted',
  '--store-bg',
  '--primary-foreground',
  '--font-display',
  '--font-body',
]

const THEME_ATTRIBUTES = [
  'data-store-theme',
  'data-store-accent',
  'data-store-bg',
  'data-store-mode',
  'data-store-font',
]

/** Removes everything applyStoreTheme set, so a theme can't outlive its page. */
export function clearStoreTheme(root?: HTMLElement): void {
  const el = root ?? document.documentElement
  for (const property of THEME_PROPERTIES) el.style.removeProperty(property)
  for (const attribute of THEME_ATTRIBUTES) el.removeAttribute(attribute)
}
