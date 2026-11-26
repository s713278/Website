// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vendorImagesService, vendorProductsService } from '@/shared/api'
import { VendorAccountContext, type VendorAccount } from '@/modules/vendor/hooks/use-vendor-account'
import { MAX_PRODUCT_PHOTO_BYTES } from '@/modules/vendor/lib/product-photo'
import type { VendorProductDetails, VendorSize } from '@/modules/vendor/types/dashboard'
import { VendorProductsPage } from './VendorProductsPage'

/**
 * Vitest globals are off, so Testing Library's automatic cleanup never registers itself.
 * Unmount by hand, or the previous render stays in the document and `screen` queries
 * match two copies of the page.
 */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Every row reads its photo; keep those reads off the network unless a test says otherwise. */
beforeEach(() => {
  vi.spyOn(vendorImagesService, 'getProductImage').mockResolvedValue(null)
  vi.spyOn(vendorImagesService, 'uploadProductImage').mockRejectedValue(new Error('Unexpected upload'))
  // jsdom has no object URLs; the editor previews a chosen file with one.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

/**
 * The account comes from the shell, so the page is rendered against a fixed one. That is
 * the point of the provider: a page no longer resolves its own vendor id, and no longer
 * falls back to a hardcoded demo id when the session has none.
 */
function accountFor(vendorId: string): VendorAccount {
  return {
    vendorId,
    context: {
      vendorId,
      businessName: 'Test Store',
      storeIdentifier: null,
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      membershipRole: 'OWNER',
      onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
      subscription: {
        tier: 'FREE',
        planName: 'Free',
        status: 'ACTIVE',
        currency: 'INR',
        monthlyPrice: 0,
        yearlyPrice: 0,
        trialEndsAt: null,
        trialDays: 0,
        limits: { maxCategories: 3, maxProducts: 10, maxSkus: 25, maxImages: 10 },
        usage: { categories: 1, products: 1, skus: 1, images: 0 },
      },
      eligibleFeatures: ['DASHBOARD'],
    },
    storeState: 'OPEN',
    plan: {
      code: 'FREE',
      name: 'Free',
      status: 'ACTIVE',
      currency: 'INR',
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialEndsAt: null,
      trialDays: 0,
      limits: { categories: 3, products: 10, skus: 25, images: 10 },
      usage: { categories: 1, products: 1, skus: 1, images: 0 },
    },
    reload: () => {},
    contextStale: false,
    refreshContext: async () => { throw new Error('Context refresh is outside this test.') },
  }
}

/** The panel's "Edit in setup" is a router link, so the page needs a router around it. */
function renderFor(vendorId: string) {
  return render(
    <MemoryRouter>
      <VendorAccountContext.Provider value={accountFor(vendorId)}>
        <VendorProductsPage />
      </VendorAccountContext.Provider>
    </MemoryRouter>,
  )
}

/** A promise this test settles by hand, so the two responses can land out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function size(name: string): VendorSize {
  return {
    skuId: `sku-${name}`,
    productId: `p-${name}`,
    priceId: `price-${name}`,
    name,
    size: '1 kg',
    listPrice: 100,
    salePrice: 90,
    active: true,
    imagePath: null,
  }
}

describe('VendorProductsPage', () => {
  it('ignores a response that arrives after the page moved to another store', async () => {
    // The contract every dashboard surface depends on: a torn-down fetch must not
    // overwrite fresh state. Resolving out of order is what reproduces it.
    const first = deferred<VendorSize[]>()
    const second = deferred<VendorSize[]>()
    const listSizes = vi
      .spyOn(vendorProductsService, 'listSizes')
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const view = renderFor('vendor-1')
    view.rerender(
      <MemoryRouter>
        <VendorAccountContext.Provider value={accountFor('vendor-2')}>
          <VendorProductsPage />
        </VendorAccountContext.Provider>
      </MemoryRouter>,
    )

    await act(async () => {
      second.resolve([size('Fresh Tomatoes')])
      first.resolve([size('Stale Rice')])
      await Promise.resolve()
    })

    expect(listSizes).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Fresh Tomatoes')).toBeTruthy()
    expect(screen.queryByText('Stale Rice')).toBeNull()
  })

  it('keeps one product open at a time', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice'), size('Dal')])

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    const rice = screen.getByRole('button', { name: /^Rice/ })
    const dal = screen.getByRole('button', { name: /^Dal/ })
    expect(rice.getAttribute('aria-expanded')).toBe('false')
    expect(dal.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(rice)
    expect(rice.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(dal)
    expect(dal.getAttribute('aria-expanded')).toBe('true')
    expect(rice.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(dal)
    expect(dal.getAttribute('aria-expanded')).toBe('false')
  })

  it('shows six products a page', async () => {
    const names = ['Rice', 'Dal', 'Milk', 'Ghee', 'Salt', 'Jaggery', 'Honey']
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue(names.map(size))

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getAllByRole('button', { name: /^Edit details of / })).toHaveLength(6)
    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getAllByRole('button', { name: /^Edit details of / })).toHaveLength(1)
  })

  it('offers no price control for a size with no price record', async () => {
    // The write is addressed to the price id; without one there is nowhere to send it.
    const priceless: VendorSize = { ...size('Loose Grain'), priceId: null }
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([priceless])

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Loose Grain/ }))

    expect(screen.getByText('No price record')).toBeTruthy()
    expect(screen.queryByText('Edit price')).toBeNull()
  })

  it('keeps the panel header while the first read is in flight', () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockReturnValue(deferred<VendorSize[]>().promise)

    renderFor('vendor-1')

    expect(screen.getByText('Your catalog')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Edit in setup' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Loading products' })).toBeTruthy()
  })

  it('says a failed first read failed, not that the catalog is empty', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockRejectedValue(new Error('Network down'))

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Nothing listed yet')).toBeNull()
  })

  it('keeps the list on screen, dimmed, while a price save re-reads it', async () => {
    const reread = deferred<VendorSize[]>()
    vi.spyOn(vendorProductsService, 'listSizes')
      .mockResolvedValueOnce([size('Rice')])
      .mockReturnValueOnce(reread.promise)
    vi.spyOn(vendorProductsService, 'updatePrice').mockResolvedValue(undefined)

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Rice/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }))
    fireEvent.change(screen.getByLabelText('Selling price'), { target: { value: '80' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save price' }))
      await Promise.resolve()
    })

    const kept = screen.getByRole('button', { name: /^Rice/ })
    expect(kept.closest('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByRole('status', { name: 'Updating products' })).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Loading products' })).toBeNull()

    await act(async () => {
      reread.resolve([{ ...size('Rice'), salePrice: 80 }])
      await Promise.resolve()
    })

    expect(screen.getAllByText('₹80').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /^Rice/ }).closest('[aria-busy]')).toBeNull()
    expect(screen.queryByRole('status', { name: 'Updating products' })).toBeNull()
  })

  it('drops an abandoned price draft on Escape and moves focus with the editor', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    const update = vi.spyOn(vendorProductsService, 'updatePrice')

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Rice/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }))
    const sale = screen.getByLabelText('Selling price') as HTMLInputElement
    await waitFor(() => expect(document.activeElement).toBe(sale))
    fireEvent.change(sale, { target: { value: '12' } })
    fireEvent.keyDown(sale, { key: 'Escape' })

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit price' })),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }))
    expect((screen.getByLabelText('Selling price') as HTMLInputElement).value).toBe('90')
    expect(update).not.toHaveBeenCalled()
  })

  it('saves a price when the form is submitted, and says which size was saved', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    const update = vi.spyOn(vendorProductsService, 'updatePrice').mockResolvedValue(undefined)

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Rice/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }))
    const sale = screen.getByLabelText('Selling price')
    fireEvent.change(sale, { target: { value: '80' } })
    await act(async () => {
      // What Enter in a field does.
      fireEvent.submit(sale.closest('form')!)
      await Promise.resolve()
    })

    expect(update).toHaveBeenCalledWith('price-Rice', { skuId: 'sku-Rice', listPrice: 100, salePrice: 80 })
    expect(document.body.textContent).toContain('Rice, 1 kg price saved.')
  })

  async function openPriceForm() {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Rice/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }))
    return {
      sale: screen.getByLabelText('Selling price') as HTMLInputElement,
      mrp: screen.getByLabelText('MRP') as HTMLInputElement,
      save: screen.getByRole('button', { name: 'Save price' }) as HTMLButtonElement,
    }
  }

  it('keeps Save price off until a price changes, and sends nothing for an unchanged one', async () => {
    const update = vi.spyOn(vendorProductsService, 'updatePrice')
    const { sale, save } = await openPriceForm()

    expect(save.disabled).toBe(true)
    fireEvent.submit(sale.closest('form')!)
    expect(update).not.toHaveBeenCalled()
    fireEvent.change(sale, { target: { value: '85' } })
    expect(save.disabled).toBe(false)
    // Typed back to what is saved, there is nothing to save again.
    fireEvent.change(sale, { target: { value: '90.0' } })
    expect(save.disabled).toBe(true)
  })

  it('previews the typed prices as the shop shows them', async () => {
    const { sale } = await openPriceForm()
    const form = sale.closest('form')!

    fireEvent.change(sale, { target: { value: '75' } })
    expect(within(form).getByText('On your shop')).toBeTruthy()
    expect(within(form).getByText('25% off')).toBeTruthy()
    expect(form.querySelector('s')?.textContent).toBe('₹100')

    // At the MRP there is no discount, and the shop strikes nothing through.
    fireEvent.change(sale, { target: { value: '100' } })
    expect(within(form).queryByText(/% off/)).toBeNull()
    expect(form.querySelector('s')).toBeNull()
  })

  it('names the price to fix, and marks only that field', async () => {
    const { sale, mrp, save } = await openPriceForm()
    const described = (input: HTMLInputElement) =>
      document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent

    fireEvent.change(sale, { target: { value: '120' } })
    expect(described(sale)).toBe('The selling price cannot be more than the MRP of ₹100.')
    expect(mrp.getAttribute('aria-invalid')).toBeNull()
    expect(save.disabled).toBe(true)

    fireEvent.change(sale, { target: { value: '90' } })
    fireEvent.change(mrp, { target: { value: '' } })
    expect(described(mrp)).toBe('Enter the MRP as a number above 0.')
    expect(sale.getAttribute('aria-invalid')).toBeNull()
  })

  it('reads each product photo by vendor product id and flags a product without one', async () => {
    const read = vi.mocked(vendorImagesService.getProductImage).mockImplementation(async (_vendor, productId) =>
      productId === 'p-Rice' ? 'https://images.example.test/rice.webp' : null,
    )
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice'), size('Dal')])

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    expect(read.mock.calls.map(([vendorId, productId]) => [vendorId, productId])).toEqual([
      ['vendor-1', 'p-Rice'],
      ['vendor-1', 'p-Dal'],
    ])
    expect(screen.getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe('https://images.example.test/rice.webp')
    expect(screen.getByRole('button', { name: 'Add a photo of Dal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Rice/ }).closest('li')?.textContent).not.toContain('Needs photo')
    expect(screen.getByRole('button', { name: /^Dal/ }).closest('li')?.textContent).toContain('Needs photo')
  })

  it('offers no photo for a size without a vendor product id', async () => {
    const read = vi.mocked(vendorImagesService.getProductImage)
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([{ ...size('Loose Grain'), productId: null }])

    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Loose Grain/ }))

    expect(read).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /photo of Loose Grain/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Edit details/ })).toBeNull()
  })
})

describe('vendor product details editor', () => {
  /** `details` is what the read answers: a value, a promise this test settles, or an error. */
  async function openEditorFor(name: string, details: VendorProductDetails | Promise<VendorProductDetails> | Error) {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size(name)])
    const read = vi.spyOn(vendorProductsService, 'getProductDetails')
    if (details instanceof Error) read.mockRejectedValueOnce(details)
    else if (details instanceof Promise) read.mockReturnValue(details)
    else read.mockResolvedValue(details)
    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    const opener = screen.getByRole('button', { name: `Edit details of ${name}` })
    await act(async () => {
      // A real click focuses the button first; the editor hands focus back to it.
      opener.focus()
      fireEvent.click(opener)
      await Promise.resolve()
    })
    return read
  }

  it('opens for the right vendor product, loading first and then prefilled', async () => {
    const pending = deferred<VendorProductDetails>()
    const read = await openEditorFor('Milk', pending.promise)

    const editor = screen.getByRole('dialog', { name: 'Milk' })
    expect(read).toHaveBeenCalledWith('vendor-1', 'p-Milk', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(within(editor).getByRole('status', { name: 'Loading product details' })).toBeTruthy()
    expect(within(editor).queryByLabelText('Product description')).toBeNull()

    await act(async () => {
      pending.resolve({ description: 'Fresh every morning.', features: [] })
      await Promise.resolve()
    })

    expect((within(editor).getByLabelText('Product description') as HTMLTextAreaElement).value).toBe('Fresh every morning.')
    expect(editor.textContent).toContain('catalog')
  })

  it('shows the photo its row already read while the details are still loading', async () => {
    vi.mocked(vendorImagesService.getProductImage).mockResolvedValue('https://images.example.test/milk.webp')
    await openEditorFor('Milk', deferred<VendorProductDetails>().promise)

    const editor = screen.getByRole('dialog', { name: 'Milk' })
    expect(within(editor).getByRole('status', { name: 'Loading product details' })).toBeTruthy()
    expect(editor.querySelector('img')?.getAttribute('src')).toBe('https://images.example.test/milk.webp')
    expect(within(editor).getByText('Saved photo')).toBeTruthy()
    expect(vendorImagesService.getProductImage).toHaveBeenCalledTimes(1)
  })

  it('shows a load failure with Try again, which reads again', async () => {
    const read = await openEditorFor('Milk', new Error('Network down'))
    const editor = screen.getByRole('dialog', { name: 'Milk' })
    expect(within(editor).getByRole('alert')).toBeTruthy()

    read.mockResolvedValue({ description: 'Back again.', features: [] })
    await act(async () => {
      fireEvent.click(within(editor).getByRole('button', { name: /Try again/ }))
      await Promise.resolve()
    })

    expect(read).toHaveBeenCalledTimes(2)
    expect((within(editor).getByLabelText('Product description') as HTMLTextAreaElement).value).toBe('Back again.')
  })

  it('cancels the read when the editor closes before it lands', async () => {
    const read = await openEditorFor('Milk', deferred<VendorProductDetails>().promise)
    const signal = read.mock.calls[0][2]?.signal

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
  })

  async function reopen(name: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Edit details of ${name}` }))
      await Promise.resolve()
    })
    return screen.getByRole('dialog', { name })
  }

  it('reopens a product it already read without reading it again', async () => {
    const read = await openEditorFor('Milk', { description: 'Fresh every morning.', features: [] })

    const editor = await reopen('Milk')

    expect(read).toHaveBeenCalledTimes(1)
    expect(within(editor).queryByRole('status', { name: 'Loading product details' })).toBeNull()
    expect((within(editor).getByLabelText('Product description') as HTMLTextAreaElement).value).toBe('Fresh every morning.')
  })

  it('reads again after a save, since a blank description falls back to the catalog text', async () => {
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    const read = await openEditorFor('Milk', { description: 'Fresh every morning.', features: [] })
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: '' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit details of Milk' }))
      await Promise.resolve()
    })

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps Save off until the description changes, then sends only the description', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh every morning.', features: [{ label: 'Brand', detail: 'Nandini' }] })
    const editor = screen.getByRole('dialog', { name: 'Milk' })
    const save = within(editor).getByRole('button', { name: 'Save' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    fireEvent.change(within(editor).getByLabelText('Product description'), { target: { value: 'Delivered by 7 am.' } })
    expect(save.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(save)
      await Promise.resolve()
    })

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { description: 'Delivered by 7 am.' })
    expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
    expect(document.body.textContent).toContain('Milk details saved.')
  })

  it('sends a cleared description as a blank string', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh every morning.', features: [] })

    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: '' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { description: '' })
  })

  it('locks the field while saving and keeps the editor open with the server message on failure', async () => {
    const saving = deferred<void>()
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockReturnValue(saving.promise)
    await openEditorFor('Milk', { description: 'Old.', features: [] })
    const editor = screen.getByRole('dialog', { name: 'Milk' })

    fireEvent.change(within(editor).getByLabelText('Product description'), { target: { value: 'New.' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    expect((within(editor).getByLabelText('Product description') as HTMLTextAreaElement).disabled).toBe(true)

    await act(async () => {
      saving.reject(new Error('Description is too long'))
      await Promise.resolve()
    })

    expect(screen.getByRole('dialog', { name: 'Milk' })).toBeTruthy()
    expect(within(editor).getByRole('alert').textContent).toContain('Description is too long')
    expect((within(editor).getByLabelText('Product description') as HTMLTextAreaElement).disabled).toBe(false)
  })

  const RICE_PHOTO = 'https://images.example.test/rice.webp'
  const NEW_PHOTO = 'https://images.example.test/rice-new.webp'

  function pickPhoto(file: File) {
    const input = screen.getByRole('dialog', { name: 'Rice' }).querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
  }

  const png = () => new File(['png'], 'rice.png', { type: 'image/png' })

  it('opens from the row photo, using the photo the row already read', async () => {
    vi.mocked(vendorImagesService.getProductImage).mockResolvedValue(RICE_PHOTO)
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    vi.spyOn(vendorProductsService, 'getProductDetails').mockResolvedValue({ description: '', features: [] })
    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change the photo of Rice' }))
      await Promise.resolve()
    })

    const editor = screen.getByRole('dialog', { name: 'Rice' })
    expect(within(editor).getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe(RICE_PHOTO)
    expect(vendorImagesService.getProductImage).toHaveBeenCalledTimes(1)
  })

  it('previews a picked photo without uploading it, and can go back to the current one', async () => {
    vi.mocked(vendorImagesService.getProductImage).mockResolvedValue(RICE_PHOTO)
    await openEditorFor('Rice', { description: '', features: [] })
    const editor = screen.getByRole('dialog', { name: 'Rice' })
    const save = within(editor).getByRole('button', { name: 'Save' }) as HTMLButtonElement

    pickPhoto(png())

    expect(vendorImagesService.uploadProductImage).not.toHaveBeenCalled()
    expect(within(editor).getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe('blob:preview')
    expect(save.disabled).toBe(false)

    expect(within(editor).getByText('rice.png · Not saved yet')).toBeTruthy()
    const remove = within(editor).getByRole('button', { name: 'Undo photo change' })
    remove.focus()
    fireEvent.click(remove)

    // Undo goes with the picked file, so focus moves to the photo it sat on.
    expect(document.activeElement).toBe(within(editor).getByRole('button', { name: 'Change the photo of Rice' }))
    expect(within(editor).queryByRole('button', { name: 'Undo photo change' })).toBeNull()
    expect(within(editor).getByText('Saved photo')).toBeTruthy()

    expect(within(editor).getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe(RICE_PHOTO)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(save.disabled).toBe(true)
  })

  it('refuses an unsupported file on pick, with no upload', async () => {
    await openEditorFor('Rice', { description: '', features: [] })

    pickPhoto(new File(['svg'], 'rice.svg', { type: 'image/svg+xml' }))

    expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG, WebP or GIF')
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(vendorImagesService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('refuses a photo over 3 MB on pick, with no upload', async () => {
    await openEditorFor('Rice', { description: '', features: [] })
    const big = new File([new Uint8Array(MAX_PRODUCT_PHOTO_BYTES + 1)], 'rice.png', { type: 'image/png' })

    pickPhoto(big)

    expect(screen.getByRole('alert').textContent).toContain('3 MB or smaller')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    expect(vendorImagesService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('opens from the Add photo placeholder of a product without a photo', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    vi.spyOn(vendorProductsService, 'getProductDetails').mockResolvedValue({ description: '', features: [] })
    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add a photo of Rice' }))
      await Promise.resolve()
    })

    const editor = screen.getByRole('dialog', { name: 'Rice' })
    expect(within(editor).getByRole('button', { name: 'Add a photo of Rice' })).toBeTruthy()
    expect(within(editor).getByText('Add your own photo')).toBeTruthy()
    expect(vendorImagesService.uploadProductImage).not.toHaveBeenCalled()
  })

  it('replaces a picked photo with another, releasing the first preview and uploading only the second', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
    const upload = vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Rice', { description: '', features: [] })
    const editor = screen.getByRole('dialog', { name: 'Rice' })
    const second = new File(['png2'], 'rice-2.png', { type: 'image/png' })

    pickPhoto(png())
    pickPhoto(second)

    expect(within(editor).getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe('blob:second')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:second')

    await act(async () => {
      fireEvent.click(within(editor).getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledWith('vendor-1', 'p-Rice', second)
  })

  it('uploads the photo on Save before the description, then shows it on the row', async () => {
    const calls: string[] = []
    vi.mocked(vendorImagesService.uploadProductImage).mockImplementation(async () => {
      calls.push('photo')
      return NEW_PHOTO
    })
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockImplementation(async () => {
      calls.push('description')
    })
    await openEditorFor('Rice', { description: 'Old.', features: [] })
    const file = png()
    pickPhoto(file)
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'New.' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    expect(calls).toEqual(['photo', 'description'])
    expect(vendorImagesService.uploadProductImage).toHaveBeenCalledWith('vendor-1', 'p-Rice', file)
    expect(screen.queryByRole('dialog', { name: 'Rice' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe(NEW_PHOTO)
  })

  it('saves a photo alone without sending the description', async () => {
    vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails')
    await openEditorFor('Rice', { description: 'Old.', features: [] })
    pickPhoto(png())

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    expect(update).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Rice details saved.')
  })

  it('keeps the picked photo and the editor open when the upload fails, sending no description', async () => {
    vi.mocked(vendorImagesService.getProductImage).mockResolvedValue(RICE_PHOTO)
    vi.mocked(vendorImagesService.uploadProductImage).mockRejectedValue(new Error('Upload refused'))
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails')
    await openEditorFor('Rice', { description: '', features: [] })
    pickPhoto(png())
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'New.' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    const editor = screen.getByRole('dialog', { name: 'Rice' })
    expect(within(editor).getByRole('alert').textContent).toContain('Your photo did not save. Upload refused')
    expect(within(editor).getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe('blob:preview')
    expect((within(editor).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('says the photo saved when only the description failed, and retries just the description', async () => {
    const upload = vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockRejectedValueOnce(new Error('Too long'))
    await openEditorFor('Rice', { description: 'Old.', features: [] })
    pickPhoto(png())
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'New.' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })
    expect(screen.getByRole('alert').textContent).toBe('Your photo is saved, but the description is not. Too long')

    update.mockResolvedValueOnce(undefined)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })

    expect(upload).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog', { name: 'Rice' })).toBeNull()
    expect(document.body.textContent).toContain('Rice details saved.')
    expect(screen.getByRole('button', { name: 'Change the photo of Rice' }).querySelector('img')?.getAttribute('src'))
      .toBe(NEW_PHOTO)
  })

  const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value

  it('shows the features as Label/Detail rows after the description, in stored order', async () => {
    await openEditorFor('Milk', {
      description: 'Fresh.',
      features: [
        { label: 'Made in', detail: 'Mandya' },
        { label: 'Brand', detail: 'Nandini' },
      ],
    })
    const editor = screen.getByRole('dialog', { name: 'Milk' })

    expect(value('Feature label 1')).toBe('Made in')
    expect(value('Feature detail 1')).toBe('Mandya')
    expect(value('Feature label 2')).toBe('Brand')
    expect(value('Feature detail 2')).toBe('Nandini')
    const description = within(editor).getByLabelText('Product description')
    expect(description.compareDocumentPosition(screen.getByLabelText('Feature label 1')) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
    expect(editor.textContent).toContain('catalog features')
    expect(editor.textContent).not.toMatch(/customers (can )?see (your |the )?features/i)
  })

  it('shows list-shaped features as rows with an empty label', async () => {
    await openEditorFor('Milk', { description: '', features: [{ label: '', detail: 'Toned milk' }] })

    expect(value('Feature label 1')).toBe('')
    expect(value('Feature detail 1')).toBe('Toned milk')
  })

  it('adds a sample row from a chip, with an example detail, and hides chips already used', async () => {
    await openEditorFor('Milk', { description: '', features: [{ label: ' brand ', detail: 'Nandini' }] })
    const editor = screen.getByRole('dialog', { name: 'Milk' })
    expect(within(editor).queryByRole('button', { name: 'Add Brand' })).toBeNull()

    fireEvent.click(within(editor).getByRole('button', { name: 'Add Made in' }))

    expect(value('Feature label 2')).toBe('Made in')
    expect(value('Feature detail 2')).toBe('')
    expect(screen.getByLabelText('Feature detail 2').getAttribute('placeholder')).toBe('e.g. Mysuru, Karnataka')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Feature detail 2')))
    expect(within(editor).queryByRole('button', { name: 'Add Made in' })).toBeNull()
    for (const sample of ['Easily Digestible', 'Health Benefits', 'How to Use', 'Ingredients', 'Good for']) {
      expect(within(editor).getByRole('button', { name: `Add ${sample}` })).toBeTruthy()
    }
  })

  it('adds an empty row for a custom label and removes any row', async () => {
    await openEditorFor('Milk', {
      description: '',
      features: [
        { label: 'Brand', detail: 'Nandini' },
        { label: 'Made in', detail: 'Mandya' },
      ],
    })
    const editor = screen.getByRole('dialog', { name: 'Milk' })

    fireEvent.click(within(editor).getByRole('button', { name: 'Add feature' }))
    expect(value('Feature label 3')).toBe('')
    expect(value('Feature detail 3')).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Feature label 3')))

    fireEvent.click(within(editor).getByRole('button', { name: 'Remove feature 1' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Remove feature 2' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Add feature' }))

    expect(value('Feature label 1')).toBe('Made in')
    expect(value('Feature label 2')).toBe('')
    expect(screen.queryByLabelText('Feature label 3')).toBeNull()
    expect(within(editor).getByRole('button', { name: 'Add Brand' })).toBeTruthy()
  })

  async function clickSave() {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await Promise.resolve()
    })
  }

  it('enables Save when the features change and sends only the features, in row order', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh.', features: [{ label: 'Brand', detail: 'Nandini' }] })
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement

    fireEvent.click(screen.getByRole('button', { name: 'Add Made in' }))
    expect(save.disabled).toBe(false)
    fireEvent.change(screen.getByLabelText('Feature detail 2'), { target: { value: 'Mandya' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    fireEvent.change(screen.getByLabelText('Feature label 3'), { target: { value: 'Fat' } })
    fireEvent.change(screen.getByLabelText('Feature detail 3'), { target: { value: '3%' } })
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', {
      features: [
        { label: 'Brand', detail: 'Nandini' },
        { label: 'Made in', detail: 'Mandya' },
        { label: 'Fat', detail: '3%' },
      ],
    })
    expect(document.body.textContent).toContain('Milk details saved.')
  })

  it('sends an empty feature set when every feature is removed', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh.', features: [{ label: 'Brand', detail: 'Nandini' }] })

    fireEvent.click(screen.getByRole('button', { name: 'Remove feature 1' }))
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { features: [] })
  })

  it('sends no features when only the description changed, leaving list-shaped rows untouched', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh.', features: [{ label: '', detail: 'Toned milk' }] })

    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'Fresher.' } })
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { description: 'Fresher.' })
  })

  it('keeps Save off when the rows end up as they were loaded', async () => {
    await openEditorFor('Milk', { description: '', features: [{ label: 'Brand', detail: 'Nandini' }] })

    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove feature 2' }))

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reads again after a features save, since an empty set falls back to the catalog features', async () => {
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    const read = await openEditorFor('Milk', { description: 'Fresh.', features: [{ label: 'Brand', detail: 'Nandini' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove feature 1' }))
    await clickSave()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit details of Milk' }))
      await Promise.resolve()
    })

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('says the photo saved when the description and features failed, and retries just the text', async () => {
    const upload = vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockRejectedValueOnce(new Error('Too long'))
    await openEditorFor('Rice', { description: 'Old.', features: [{ label: 'Brand', detail: 'Ponni' }] })
    pickPhoto(png())
    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'New.' } })
    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'Sona' } })

    await clickSave()
    expect(screen.getByRole('alert').textContent).toBe('Your photo is saved, but the description and features are not. Too long')

    update.mockResolvedValueOnce(undefined)
    await clickSave()

    expect(upload).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenLastCalledWith('vendor-1', 'p-Rice', {
      description: 'New.',
      features: [{ label: 'Brand', detail: 'Sona' }],
    })
    expect(screen.queryByRole('dialog', { name: 'Rice' })).toBeNull()
  })

  it('names only the features when they alone failed after the photo saved', async () => {
    vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    vi.spyOn(vendorProductsService, 'updateProductDetails').mockRejectedValueOnce(new Error('Too long'))
    await openEditorFor('Rice', { description: 'Old.', features: [] })
    pickPhoto(png())
    fireEvent.click(screen.getByRole('button', { name: 'Add Brand' }))
    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'Ponni' } })

    await clickSave()

    expect(screen.getByRole('alert').textContent).toBe('Your photo is saved, but the features are not. Too long')
  })

  /** The text of the error tied to an input for screen readers, or '' if none. */
  function describedError(label: string) {
    const input = screen.getByLabelText(label)
    const ids = input.getAttribute('aria-describedby')?.split(' ') ?? []
    return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
  }

  it('blocks a save with a half-filled row, showing the error next to it, until it is filled', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: '', features: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Add Brand' }))

    await clickSave()

    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Milk' })).toBeTruthy()
    expect(screen.getByLabelText('Feature detail 1').getAttribute('aria-invalid')).toBe('true')
    expect(describedError('Feature detail 1')).toContain('Add a detail for Brand')

    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'Nandini' } })
    expect(describedError('Feature detail 1')).toBe('')
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { features: [{ label: 'Brand', detail: 'Nandini' }] })
  })

  it('asks for a label on an edited list-shaped row before saving', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', {
      description: '',
      features: [
        { label: '', detail: 'Toned milk' },
        { label: '', detail: 'Pasteurised' },
      ],
    })
    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'Toned milk, 3% fat' } })

    await clickSave()

    expect(update).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Feature label 1').getAttribute('aria-invalid')).toBe('true')
    expect(describedError('Feature label 1')).toContain('Add a label')
    expect(describedError('Feature label 2')).toContain('Add a label')
  })

  it('blocks a save when two rows share a label, ignoring case and spaces', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: '', features: [{ label: 'Brand', detail: 'Nandini' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    fireEvent.change(screen.getByLabelText('Feature label 2'), { target: { value: '  bRAND ' } })
    fireEvent.change(screen.getByLabelText('Feature detail 2'), { target: { value: 'Amul' } })

    await clickSave()

    expect(update).not.toHaveBeenCalled()
    expect(describedError('Feature label 1')).toBe('')
    expect(describedError('Feature label 2')).toContain('already used')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Feature label 2')))
  })

  it('ignores rows left completely empty when saving', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: '', features: [{ label: 'Brand', detail: 'Nandini' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    fireEvent.change(screen.getByLabelText('Feature label 3'), { target: { value: 'Fat' } })
    fireEvent.change(screen.getByLabelText('Feature detail 3'), { target: { value: ' 3% ' } })

    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', {
      features: [
        { label: 'Brand', detail: 'Nandini' },
        { label: 'Fat', detail: '3%' },
      ],
    })
  })

  it('treats a blank row beside untouched list-shaped rows as no feature change', async () => {
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Milk', { description: 'Fresh.', features: [{ label: '', detail: 'Toned milk' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Add feature' }))
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Product description'), { target: { value: 'Fresher.' } })
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Milk', { description: 'Fresher.' })
  })

  it('announces each blocked save again', async () => {
    await openEditorFor('Milk', { description: '', features: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Add Brand' }))

    await clickSave()
    const first = screen.getByRole('alert')
    await clickSave()

    expect(screen.getByRole('alert')).not.toBe(first)
  })

  it('treats spaces added around a feature as no change', async () => {
    await openEditorFor('Milk', { description: '', features: [{ label: 'Brand', detail: 'Nandini' }] })

    fireEvent.change(screen.getByLabelText('Feature label 1'), { target: { value: 'Brand ' } })

    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('asks the vendor to shorten features over the size limit instead of sending them', async () => {
    const upload = vi.mocked(vendorImagesService.uploadProductImage).mockResolvedValue(NEW_PHOTO)
    const update = vi.spyOn(vendorProductsService, 'updateProductDetails').mockResolvedValue(undefined)
    await openEditorFor('Rice', { description: '', features: [{ label: 'Ingredients', detail: 'Rice' }] })
    pickPhoto(png())
    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'a'.repeat(17_000) } })

    await clickSave()

    expect(upload).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    const sizeMessage = screen.getByText(/too long to save.*[Ss]horten/)
    await waitFor(() => expect(document.activeElement).toBe(sizeMessage))

    fireEvent.change(screen.getByLabelText('Feature detail 1'), { target: { value: 'Ponni rice' } })
    await clickSave()

    expect(update).toHaveBeenCalledWith('vendor-1', 'p-Rice', { features: [{ label: 'Ingredients', detail: 'Ponni rice' }] })
  })

  it('leaves price editing in the list', async () => {
    vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
    renderFor('vendor-1')
    await act(async () => {
      await Promise.resolve()
    })
    fireEvent.click(screen.getByRole('button', { name: /^Rice/ }))
    expect(screen.getByRole('button', { name: 'Edit price' })).toBeTruthy()
  })

  describe('leaving the editor', () => {
    const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    const editorFor = (name: string) => screen.getByRole('dialog', { name })
    const confirmation = () => screen.queryByRole('alertdialog', { name: 'Discard your changes?' })
    const clickClose = (name: string) => fireEvent.click(within(editorFor(name)).getByRole('button', { name: 'Close' }))
    const clickCancel = (name: string) =>
      fireEvent.click(within(editorFor(name)).getByRole('button', { name: 'Cancel' }))

    function tapOverlay() {
      const overlay = document.querySelector('[data-vaul-overlay]') as HTMLElement
      fireEvent.pointerDown(overlay)
      fireEvent.click(overlay)
    }

    function typeDescription(name: string, value: string) {
      fireEvent.change(within(editorFor(name)).getByLabelText('Product description'), { target: { value } })
    }

    /** Edits are what make the editor ask; this is the smallest one. */
    async function openDirty() {
      await openEditorFor('Milk', { description: 'Old.', features: [] })
      typeDescription('Milk', 'New.')
    }

    const closers: [string, () => void][] = [
      ['the close button', () => clickClose('Milk')],
      ['Cancel', () => clickCancel('Milk')],
      ['Escape', escape],
    ]

    it.each(closers)('asks before %s discards edits, and keeps them when the vendor keeps editing', async (_way, close) => {
      await openDirty()

      close()

      const asking = confirmation()
      expect(asking).toBeTruthy()
      expect(within(asking!).getByText('Your changes to Milk are not saved.')).toBeTruthy()
      fireEvent.click(within(asking!).getByRole('button', { name: 'Keep editing' }))

      expect(confirmation()).toBeNull()
      expect((within(editorFor('Milk')).getByLabelText('Product description') as HTMLTextAreaElement).value).toBe('New.')
    })

    it.each(closers)('closes the editor, dropping the edits, once %s is confirmed', async (_way, close) => {
      await openDirty()

      close()
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Discard' }))

      expect(confirmation()).toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
      // Opened again, the editor starts from what was saved, not from the discarded edit.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Edit details of Milk' }))
        await Promise.resolve()
      })
      expect((within(editorFor('Milk')).getByLabelText('Product description') as HTMLTextAreaElement).value).toBe('Old.')
    })

    it('does not ask when the editor is opened again and closed untouched after a discard', async () => {
      await openDirty()
      clickClose('Milk')
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Discard' }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Edit details of Milk' }))
        await Promise.resolve()
      })

      clickClose('Milk')

      expect(confirmation()).toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
    })

    it('asks before a tap outside the editor discards edits', async () => {
      await openDirty()

      // Radix listens for the tap on the document, one tick after the editor opens.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      tapOverlay()

      expect(confirmation()).toBeTruthy()
      // Behind the confirmation the editor is hidden from the accessibility tree, but still open.
      expect(document.querySelector('[data-vaul-drawer]')?.textContent).toContain('Milk')
    })

    it('words the way back as "Keep editing", not a bare Cancel', async () => {
      await openDirty()

      clickClose('Milk')

      const asking = confirmation()!
      expect(within(asking).getByRole('button', { name: 'Keep editing' })).toBeTruthy()
      expect(within(asking).getByRole('button', { name: 'Discard' })).toBeTruthy()
      expect(within(asking).queryByRole('button', { name: 'Cancel' })).toBeNull()
    })

    it('eases the overlay a swipe dimmed back to full, rather than jumping it', async () => {
      await openDirty()
      // What vaul leaves behind when a swipe is taken for a dismissal.
      const overlay = document.querySelector('[data-vaul-overlay]') as HTMLElement
      overlay.style.opacity = '0.4'
      overlay.style.transition = 'none'

      clickClose('Milk')

      expect(overlay.style.opacity).toBe('1')
      expect(overlay.style.transition).toContain('opacity')

      fireEvent.transitionEnd(overlay)

      expect(overlay.style.opacity).toBe('')
      expect(overlay.style.transition).toBe('')
    })

    it('counts a picked photo as unsaved changes', async () => {
      await openEditorFor('Rice', { description: '', features: [] })
      pickPhoto(png())

      clickClose('Rice')

      expect(confirmation()).toBeTruthy()
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Discard' }))
      expect(screen.queryByRole('dialog', { name: 'Rice' })).toBeNull()
      expect(vendorImagesService.uploadProductImage).not.toHaveBeenCalled()
    })

    it('counts a feature edit as unsaved changes', async () => {
      await openEditorFor('Milk', { description: '', features: [] })
      fireEvent.click(within(editorFor('Milk')).getByRole('button', { name: 'Add Brand' }))
      fireEvent.change(within(editorFor('Milk')).getByLabelText('Feature detail 1'), { target: { value: 'Nandini' } })

      escape()

      expect(confirmation()).toBeTruthy()
    })

    it.each(closers)('closes at once with %s when nothing changed', async (_way, close) => {
      await openEditorFor('Milk', { description: 'Old.', features: [] })

      close()

      expect(confirmation()).toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
    })

    it('closes at once after edits are put back as they were', async () => {
      await openDirty()
      typeDescription('Milk', 'Old.')

      clickClose('Milk')

      expect(confirmation()).toBeNull()
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
    })

    it('does not close, or ask, in any way while a save runs', async () => {
      const saving = deferred<void>()
      vi.spyOn(vendorProductsService, 'updateProductDetails').mockReturnValue(saving.promise)
      await openDirty()
      fireEvent.click(within(editorFor('Milk')).getByRole('button', { name: 'Save' }))

      const close = within(editorFor('Milk')).getByRole('button', { name: 'Close' }) as HTMLButtonElement
      const cancel = within(editorFor('Milk')).getByRole('button', { name: 'Cancel' }) as HTMLButtonElement
      expect([close.disabled, cancel.disabled]).toEqual([true, true])
      fireEvent.click(close)
      fireEvent.click(cancel)
      escape()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      tapOverlay()

      expect(confirmation()).toBeNull()
      expect(editorFor('Milk')).toBeTruthy()

      await act(async () => {
        saving.resolve()
        await Promise.resolve()
      })
      expect(screen.queryByRole('dialog', { name: 'Milk' })).toBeNull()
      expect(confirmation()).toBeNull()
    })

    it('moves focus into the editor, keeps it there, and returns it to Edit details on close', async () => {
      await openEditorFor('Milk', { description: 'Old.', features: [] })
      const editButton = document.querySelector('button[aria-label="Edit details of Milk"]') as HTMLButtonElement

      await waitFor(() => expect(editorFor('Milk').contains(document.activeElement)).toBe(true))
      editButton.focus()
      expect(editorFor('Milk').contains(document.activeElement)).toBe(true)

      clickClose('Milk')

      await waitFor(() => expect(document.activeElement).toBe(editButton))
    })

    it('returns focus to the row photo it was opened from', async () => {
      vi.spyOn(vendorProductsService, 'listSizes').mockResolvedValue([size('Rice')])
      vi.spyOn(vendorProductsService, 'getProductDetails').mockResolvedValue({ description: '', features: [] })
      renderFor('vendor-1')
      await act(async () => {
        await Promise.resolve()
      })
      const photo = screen.getByRole('button', { name: 'Add a photo of Rice' })
      photo.focus()
      await act(async () => {
        fireEvent.click(photo)
        await Promise.resolve()
      })
      await waitFor(() => expect(editorFor('Rice').contains(document.activeElement)).toBe(true))

      escape()

      await waitFor(() => expect(document.activeElement).toBe(photo))
    })

    it('returns focus to the close button that asked, when the vendor keeps editing', async () => {
      await openDirty()
      const close = within(editorFor('Milk')).getByRole('button', { name: 'Close' })
      close.focus()

      fireEvent.click(close)
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Keep editing' }))

      await waitFor(() => expect(document.activeElement).toBe(close))
    })

    it('returns focus to the description when Escape in it is answered by keeping editing', async () => {
      await openDirty()
      const description = within(editorFor('Milk')).getByLabelText('Product description')
      description.focus()

      escape()
      expect(confirmation()).toBeTruthy()
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

      await waitFor(() => expect(confirmation()).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(description))
      expect((description as HTMLTextAreaElement).value).toBe('New.')
    })

    it('returns focus into the editor when a tap outside is answered by keeping editing', async () => {
      await openDirty()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      // A tap outside leaves nothing inside the editor focused.
      ;(document.activeElement as HTMLElement).blur()
      tapOverlay()
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Keep editing' }))

      await waitFor(() => expect(editorFor('Milk').contains(document.activeElement)).toBe(true))
    })

    it('returns focus to the opener after a discard too', async () => {
      await openDirty()
      const editButton = document.querySelector('button[aria-label="Edit details of Milk"]') as HTMLButtonElement

      clickClose('Milk')
      fireEvent.click(within(confirmation()!).getByRole('button', { name: 'Discard' }))

      await waitFor(() => expect(document.activeElement).toBe(editButton))
    })
  })
})
