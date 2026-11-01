// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StoreSharePanels } from './StoreSharePanels'

const qr = vi.hoisted(() => ({ toDataURL: vi.fn((): Promise<string> => new Promise(() => {})) }))
vi.mock('qrcode', () => ({ default: qr }))

afterEach(cleanup)

describe('StoreSharePanels', () => {
  it('opens the storefront in a new tab so the vendor keeps this screen', () => {
    render(
      <MemoryRouter>
        <StoreSharePanels identifier="anithas-pickles" storeName="Anitha's Pickles" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('button', { name: 'Open storefront' }).closest('a')
    expect(link?.getAttribute('href')).toBe('/stores/anithas-pickles')
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noreferrer')
  })

  it('shows a skeleton under one status while the QR code draws, and No code if drawing fails', async () => {
    let fail!: (error: unknown) => void
    qr.toDataURL.mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
    render(
      <MemoryRouter>
        <StoreSharePanels identifier="anithas-pickles" storeName="Anitha's Pickles" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('status', { name: 'Drawing QR code' })).toBeTruthy()
    expect(screen.queryByText('Drawing…')).toBeNull()
    await act(async () => { fail(new Error('no canvas')) })
    expect(screen.getByText('No code')).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Drawing QR code' })).toBeNull()
  })
})
