import type { FontPreset } from './theme'

/**
 * Families already requested this session. Backed up by a DOM check in ensureFontLoaded,
 * since HMR can reset this module while the injected <link> elements survive.
 */
const injected = new Set<string>()

function googleFontsUrl(preset: FontPreset): string {
  const family = preset.family.replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${preset.weights}&display=swap`
}

/**
 * Injects the Google Fonts stylesheet for a preset, once per family.
 *
 * Injected <link>s are deliberately never removed: they are a few bytes, the stylesheets
 * are HTTP-cached, and a customer browsing several stores would otherwise re-trigger a
 * flash of fallback text on every revisit. Total injections are bounded by FONT_PRESETS.
 */
export function ensureFontLoaded(preset: FontPreset): void {
  if (preset.alreadyLoaded) return
  if (injected.has(preset.family)) return
  if (typeof document === 'undefined') return

  const existing = document.querySelector(`link[data-font-family="${CSS.escape(preset.family)}"]`)
  if (existing) {
    injected.add(preset.family)
    return
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = googleFontsUrl(preset)
  link.dataset.fontFamily = preset.family
  document.head.appendChild(link)
  injected.add(preset.family)
}
