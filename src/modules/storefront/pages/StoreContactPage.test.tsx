// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { catalogService, type StoreContact } from '@/shared/api'
import type { Store } from '@/modules/storefront/types'
import { StoreContactPage } from './StoreContactPage'

const logoUrl = 'https://cdn.example.com/srk-logo.png'

const shop = {
  id: '273',
  name: 'SRK Traditional Foods and Pickles',
  products: [],
  theme: {
    primaryColor: '#10b981',
    accentColor: '#f97316',
    logoImage: logoUrl,
  },
} as unknown as Store

const contact: StoreContact = {
  businessName: 'SRK Traditional Foods and Pickles',
  storeIdentifier: 'srk_store',
  ownerName: 'SRK Patel',
  contactNumber: '919111111111',
  mainAddress: {
    address1: 'MIG 3-973/L',
    address2: 'Raod No-27F,Mayurinagar',
    locality: 'Miyapur',
    district: 'Ranga Reddy',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    zipCode: '500049',
    latitude: '17.510041',
    longitude: '78.365615',
  },
  addresses: [],
  socialLinks: [
    { id: '1', platform: 'INSTAGRAM', url: 'https://www.instagram.com/mithradirect/' },
    { id: '2', platform: 'YOUTUBE', url: 'https://www.youtube.com/@MithraDirect' },
  ],
}

function renderContact(storeId = '273') {
  return render(
    <MemoryRouter initialEntries={[`/stores/${storeId}/contact`]}>
      <Routes>
        <Route path="/stores/:storeId/contact" element={<StoreContactPage />} />
        <Route path="/stores/:storeId" element={<p>Shop home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  const css = globalThis.CSS as { escape?: (value: string) => string } | undefined
  if (!css) {
    Object.defineProperty(globalThis, 'CSS', { value: { escape: (value: string) => value }, configurable: true })
    return
  }
  if (!css.escape) css.escape = (value: string) => value
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('StoreContactPage', () => {
  it('renders the contact-us payload and the shop logo', async () => {
    const getStoreContact = vi.spyOn(catalogService, 'getStoreContact').mockResolvedValue(contact)
    const getStore = vi.spyOn(catalogService, 'getStore').mockResolvedValue(shop)

    renderContact()

    expect(await screen.findByText('SRK Patel')).toBeTruthy()
    expect(document.querySelector('header img')?.getAttribute('src')).toBe(logoUrl)
    expect(screen.getByText('SRK Patel')).toBeTruthy()
    expect(screen.getByText('+91 91111 11111')).toBeTruthy()
    expect(screen.getByText('srk_store')).toBeTruthy()
    expect(screen.getByText('MIG 3-973/L')).toBeTruthy()
    expect(screen.getByText('Raod No-27F,Mayurinagar')).toBeTruthy()
    expect(screen.getByText('Ranga Reddy')).toBeTruthy()
    expect(screen.getByText('PIN: 500049')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Chat on WhatsApp/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open in Maps/ }).getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=17.510041%2C78.365615',
    )
    expect(screen.getByRole('link', { name: /Instagram/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /YouTube/ })).toBeTruthy()
    expect(getStoreContact).toHaveBeenCalledWith('273')
    expect(getStore).toHaveBeenCalledWith('273')
  })

  it('returns to the shop when contact-us has nothing to show', async () => {
    vi.spyOn(catalogService, 'getStoreContact').mockResolvedValue(null)
    vi.spyOn(catalogService, 'getStore').mockResolvedValue(null)

    renderContact()

    await waitFor(() => {
      expect(screen.getByText('Shop home')).toBeTruthy()
    })
  })
})
