import type { StorefrontConfigInput } from './vendor-onboarding'

/** Editable settings only; absent theme values use the wizard's existing defaults. */
export type VendorStorefrontSettings = Omit<StorefrontConfigInput, 'theme' | 'uploadedLogoUrl' | 'uploadedBannerUrl'> & {
  theme: Partial<StorefrontConfigInput['theme']>
}

function invalid(): never {
  throw new Error('Saved storefront settings could not be read. Please retry before making changes.')
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : invalid()
}

function list(value: unknown): unknown[] {
  if (value == null) return []
  return Array.isArray(value) ? value : invalid()
}

function choice<T extends string>(value: unknown, choices: readonly T[]): T | undefined {
  if (value == null || value === '') return undefined
  return choices.find((item) => item === value) ?? invalid()
}

/** Keep explicit empty collections/text; the customer display mapper supplies demo fallbacks. */
export function mapVendorStorefrontSettings(payload: unknown, vendorId: number | string): VendorStorefrontSettings {
  const envelope = record(payload)
  const data = record(envelope.data ?? envelope)
  if (String(data.vendor_id) !== String(vendorId) || !text(data.business_name).trim()) return invalid()
  const theme = data.theme == null ? {} : record(data.theme)
  const colors = ['primaryColor', 'accentColor', 'backgroundColor', 'textColor'] as const
  const wireColors = ['primary_color', 'accent_color', 'background_color', 'text_color'] as const
  const mappedTheme: VendorStorefrontSettings['theme'] = {}
  colors.forEach((key, index) => {
    const value = text(theme[wireColors[index]])
    if (value) mappedTheme[key] = /^#[\da-f]{3}$/i.test(value)
      ? `#${value.slice(1).split('').map((digit) => digit + digit).join('')}` : value
  })
  const font = text(theme.font_family)
  if (font) mappedTheme.fontFamily = font
  const button = choice(theme.button_shape, ['PILL', 'ROUNDED', 'SQUARE'] as const)
  const card = choice(theme.card_style, ['FLAT', 'SHADOW', 'BORDER'] as const)
  if (button) mappedTheme.buttonShape = button
  if (card) mappedTheme.cardStyle = card
  mappedTheme.themePreset = choice(theme.theme_preset, ['WARM', 'FRESH', 'MINIMAL', 'BOLD'] as const) ?? null
  return {
    storeName: text(data.business_name),
    tagline: text(data.tagline),
    businessLocation: text(data.business_location),
    instagram: text(data.instagram_url),
    orderWhatsapp: text(data.order_whatsapp_number),
    supportWhatsapp: text(data.support_whatsapp_number),
    welcomeMessage: text(data.welcome_message),
    announcementBar: text(data.announcement_bar),
    heroBadges: list(data.hero_badges).map((item) => typeof item === 'string' ? item : invalid()),
    trustStrip: list(data.trust_strip).map((item) => {
      const badge = record(item)
      return { icon: text(badge.icon), title: text(badge.title), subtitle: text(badge.subtitle), enabled: true }
    }),
    theme: mappedTheme,
  }
}
