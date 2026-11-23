// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_WRITE_SIGNAL_KEY, AWAY_AFTER_MS, announceAccountWrite, pageAwayEpoch } from './page-away'

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The tab is hidden for `ms`, then shown again. */
function hideFor(ms: number) {
  const start = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
  setVisibility('hidden')
  clock.mockReturnValue(start + ms)
  setVisibility('visible')
}

/** Another tab of this browser wrote the signal key. */
function signalFromAnotherTab(newValue: string | null, key: string | null = ACCOUNT_WRITE_SIGNAL_KEY) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }))
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('pageAwayEpoch', () => {
  it('ignores a short tab switch', () => {
    const start = pageAwayEpoch('91')
    hideFor(AWAY_AFTER_MS - 1)
    expect(pageAwayEpoch('91')).toBe(start)
  })

  it('counts a tab hidden for the threshold or longer once, when it is shown again', () => {
    const start = pageAwayEpoch('91')
    const other = pageAwayEpoch('92')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    setVisibility('hidden')
    clock.mockReturnValue(1_000 + AWAY_AFTER_MS)
    expect(pageAwayEpoch('91')).toBe(start)
    setVisibility('visible')
    expect(pageAwayEpoch('91')).toBe(start + 1)
    // Every vendor's reads predate a long away.
    expect(pageAwayEpoch('92')).toBe(other + 1)
    setVisibility('visible')
    expect(pageAwayEpoch('91')).toBe(start + 1)
  })

  it('ignores the window losing and regaining focus', () => {
    const start = pageAwayEpoch('91')
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    expect(pageAwayEpoch('91')).toBe(start)
  })

  it('ignores focus moving between elements on the page', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const start = pageAwayEpoch('91')
    input.focus()
    input.blur()
    input.dispatchEvent(new FocusEvent('focus'))
    input.dispatchEvent(new FocusEvent('blur'))
    expect(pageAwayEpoch('91')).toBe(start)
    input.remove()
  })
})

describe('account writes from another tab', () => {
  it('count for the vendor another tab saved for, and only that vendor', () => {
    const start = pageAwayEpoch('91')
    const other = pageAwayEpoch('92')
    signalFromAnotherTab(JSON.stringify({ vendorId: '91', at: 1 }))
    expect(pageAwayEpoch('91')).toBe(start + 1)
    expect(pageAwayEpoch('92')).toBe(other)
  })

  it('ignore a malformed, cleared or unrelated storage change', () => {
    const start = pageAwayEpoch('91')
    signalFromAnotherTab('not json')
    signalFromAnotherTab(JSON.stringify({ vendorId: 91, at: 1 }))
    signalFromAnotherTab('null')
    signalFromAnotherTab(null)
    signalFromAnotherTab(null, null)
    signalFromAnotherTab(JSON.stringify({ vendorId: '91', at: 1 }), 'md-auth')
    expect(pageAwayEpoch('91')).toBe(start)
  })

  it('announce a write with the vendor id and time only, changing the value every time', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1).mockReturnValueOnce(2)
    announceAccountWrite('91')
    expect(JSON.parse(localStorage.getItem(ACCOUNT_WRITE_SIGNAL_KEY)!)).toEqual({ vendorId: '91', at: 1 })
    announceAccountWrite('91')
    expect(JSON.parse(localStorage.getItem(ACCOUNT_WRITE_SIGNAL_KEY)!)).toEqual({ vendorId: '91', at: 2 })
  })

  it('announce nothing, and do not throw, when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => announceAccountWrite('91')).not.toThrow()
  })

  it('do not count the writing tab’s own announcement', () => {
    const start = pageAwayEpoch('91')
    announceAccountWrite('91')
    expect(pageAwayEpoch('91')).toBe(start)
  })
})
