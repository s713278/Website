import { describe, expect, it } from 'vitest'
import {
  canChatAboutOrder,
  orderOwnerChatHref,
  orderOwnerChatMessage,
} from './order-owner-chat'

describe('canChatAboutOrder', () => {
  it('allows open statuses', () => {
    expect(canChatAboutOrder('SCHEDULED')).toBe(true)
    expect(canChatAboutOrder('placed')).toBe(true)
    expect(canChatAboutOrder('IN_PROCESS')).toBe(true)
  })

  it('hides chat for delivered and cancelled', () => {
    expect(canChatAboutOrder('DELIVERED')).toBe(false)
    expect(canChatAboutOrder('delivered')).toBe(false)
    expect(canChatAboutOrder('CANCELLED')).toBe(false)
    expect(canChatAboutOrder('Canceled')).toBe(false)
  })
})

describe('orderOwnerChatMessage', () => {
  it('prefills order-scoped WhatsApp copy without the store name', () => {
    expect(orderOwnerChatMessage('1985')).toBe('Hi! This is about Order #1985.')
  })
})

describe('orderOwnerChatHref', () => {
  it('uses order_whatsapp_number (store.phone) over support WhatsApp', () => {
    const href = orderOwnerChatHref(
      { supportWhatsapp: '919111111111', phone: '9888888888' },
      '1983',
    )
    expect(href).toMatch(/^https:\/\/wa\.me\/9888888888\?text=/)
    expect(decodeURIComponent(href!.split('text=')[1]!)).toBe(
      'Hi! This is about Order #1983.',
    )
  })

  it('falls back to support WhatsApp when order number is missing', () => {
    const href = orderOwnerChatHref({ supportWhatsapp: '919111111111' }, '12')
    expect(href).toMatch(/^https:\/\/wa\.me\/919111111111\?text=/)
  })

  it('returns null when no owner number', () => {
    expect(orderOwnerChatHref({}, '1')).toBeNull()
    expect(orderOwnerChatHref(null, '1')).toBeNull()
  })
})
