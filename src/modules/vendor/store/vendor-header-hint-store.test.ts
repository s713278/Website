// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { mapVendorContext, type VendorContext } from '@/shared/api'
import { isStoreSubmitted, isVendorApproved } from '../lib/onboarding-account-status'
import {
  clearVendorHeaderHint,
  readVendorHeaderHint,
  rememberVendorHeaderHint,
} from './vendor-header-hint-store'

const STORAGE_KEY = 'md-vendor-header-hint'

function contextFor(
  vendorId: string,
  vendorStatus: string,
  approvalStatus: string,
  onboarding: { status: string; next_step: number | null },
): VendorContext {
  return mapVendorContext({
    data: {
      vendor_id: vendorId,
      vendor_status: vendorStatus,
      approval_status: approvalStatus,
      store_identifier: 'sk-organic-store',
      onboarding,
    },
  })
}

/** A fresh copy of the store module, hydrated from whatever is in localStorage now. */
async function reloadWith(hint: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { hint }, version: 1 }))
  vi.resetModules()
  return import('./vendor-header-hint-store')
}

afterEach(() => {
  clearVendorHeaderHint()
  localStorage.clear()
})

describe('vendor header hint', () => {
  it('remembers the signed-in vendor’s account state', () => {
    rememberVendorHeaderHint(contextFor('96', 'ACTIVE', 'APPROVED', { status: 'COMPLETED', next_step: 11 }))

    expect(readVendorHeaderHint('96')).toEqual({
      vendorId: '96',
      vendorStatus: 'ACTIVE',
      approvalStatus: 'APPROVED',
      storeIdentifier: 'sk-organic-store',
      onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
    })
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"vendorId":"96"')
  })

  it('keeps one entry, the last vendor remembered', () => {
    rememberVendorHeaderHint(contextFor('96', 'ACTIVE', 'APPROVED', { status: 'COMPLETED', next_step: 11 }))
    rememberVendorHeaderHint(contextFor('97', 'SETTING_UP', 'PENDING', { status: 'IN_PROGRESS', next_step: 5 }))

    expect(readVendorHeaderHint('96')).toBeNull()
    expect(readVendorHeaderHint('97')).toMatchObject({ vendorId: '97', vendorStatus: 'SETTING_UP' })
  })

  it('gives nothing to another vendor, or to no vendor', () => {
    rememberVendorHeaderHint(contextFor('96', 'ACTIVE', 'APPROVED', { status: 'COMPLETED', next_step: 11 }))

    expect(readVendorHeaderHint('97')).toBeNull()
    expect(readVendorHeaderHint(null)).toBeNull()
  })

  it('round-trips a completed setup with no next step, which still counts as submitted', () => {
    rememberVendorHeaderHint(contextFor('96', 'ACTIVE', 'APPROVED', { status: 'COMPLETED', next_step: null }))

    const hint = readVendorHeaderHint('96')
    expect(hint?.onboarding).toMatchObject({ status: 'COMPLETED', nextStep: null })
    expect(isStoreSubmitted({ context: hint! })).toBe(true)
    expect(isVendorApproved({ context: hint! })).toBe(true)
  })

  it('restores a well-formed persisted entry', async () => {
    const reloaded = await reloadWith({
      vendorId: '96',
      vendorStatus: 'SETTING_UP',
      approvalStatus: 'PENDING',
      storeIdentifier: null,
      onboarding: { status: 'IN_PROGRESS', description: null, nextStep: 5 },
    })

    expect(reloaded.readVendorHeaderHint('96')).toMatchObject({ vendorStatus: 'SETTING_UP', onboarding: { nextStep: 5 } })
  })

  it.each([
    ['a non-object', 'approved'],
    ['a missing vendor id', {
      vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED', storeIdentifier: null,
      onboarding: { status: 'COMPLETED', description: null, nextStep: 11 },
    }],
    ['an unknown onboarding status', {
      vendorId: '96', vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED', storeIdentifier: null,
      onboarding: { status: 'DONE', description: null, nextStep: 11 },
    }],
    ['no onboarding block', {
      vendorId: '96', vendorStatus: 'ACTIVE', approvalStatus: 'APPROVED', storeIdentifier: null,
    }],
  ])('drops a persisted entry with %s', async (_name, hint) => {
    const reloaded = await reloadWith(hint)

    expect(reloaded.readVendorHeaderHint('96')).toBeNull()
  })

  it('forgets the entry and its storage on clear', () => {
    rememberVendorHeaderHint(contextFor('96', 'ACTIVE', 'APPROVED', { status: 'COMPLETED', next_step: 11 }))
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    clearVendorHeaderHint()

    expect(readVendorHeaderHint('96')).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
