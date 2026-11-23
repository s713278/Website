import { describe, expect, it } from 'vitest'
import { mapVendorStorefrontSettings } from './vendor-storefront-settings'

const saved = {
  vendor_id: 91, business_name: 'Test Store', tagline: '', business_location: 'Test City',
  instagram_url: 'teststore', order_whatsapp_number: '+919876543210', support_whatsapp_number: '+919000000001',
  welcome_message: 'Welcome back', announcement_bar: 'Saved announcement', hero_badges: [], trust_strip: [],
  theme: { primary_color: '#123', accent_color: '#456789', background_color: '#ffffff', text_color: '#222222',
    font_family: 'Poppins', button_shape: 'SQUARE', card_style: 'BORDER', theme_preset: null },
}

describe('mapVendorStorefrontSettings', () => {
  it('restores editable settings from either response shape without customer-display fallbacks', () => {
    const settings = mapVendorStorefrontSettings(saved, '91')
    expect(mapVendorStorefrontSettings({ data: saved }, 91)).toEqual(settings)
    expect(settings).toEqual({
      storeName: 'Test Store', tagline: '', businessLocation: 'Test City', instagram: 'teststore',
      orderWhatsapp: '+919876543210', supportWhatsapp: '+919000000001', welcomeMessage: 'Welcome back',
      announcementBar: 'Saved announcement', heroBadges: [], trustStrip: [],
      theme: { primaryColor: '#112233', accentColor: '#456789', backgroundColor: '#ffffff', textColor: '#222222',
        fontFamily: 'Poppins', buttonShape: 'SQUARE', cardStyle: 'BORDER', themePreset: null },
    })
  })

  it('keeps every saved trust badge and supplies no invented badge content', () => {
    expect(mapVendorStorefrontSettings({ ...saved, trust_strip: [{ icon: 'leaf', title: 'Fresh', subtitle: '' }] }, 91).trustStrip)
      .toEqual([{ icon: 'leaf', title: 'Fresh', subtitle: '', enabled: true }])
  })

  it.each([
    null, {}, { ...saved, vendor_id: 92 }, { ...saved, business_name: '' },
    { ...saved, theme: [] }, { ...saved, theme: { card_style: 'UNKNOWN' } },
    { ...saved, hero_badges: [42] }, { ...saved, trust_strip: ['invalid'] },
    { ...saved, support_whatsapp_number: 9000000001 },
  ])('rejects unusable or foreign settings before they can overwrite a store: %j', (payload) => {
    expect(() => mapVendorStorefrontSettings(payload, 91)).toThrow('Saved storefront settings could not be read')
  })
})
