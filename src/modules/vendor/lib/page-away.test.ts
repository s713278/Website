// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { pageAwayEpoch } from './page-away'

describe('pageAwayEpoch', () => {
  it('counts the tab being hidden and shown', () => {
    const start = pageAwayEpoch()
    document.dispatchEvent(new Event('visibilitychange'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(pageAwayEpoch()).toBe(start + 2)
  })

  it('counts the window losing and regaining focus', () => {
    const start = pageAwayEpoch()
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    expect(pageAwayEpoch()).toBe(start + 2)
  })

  it('ignores focus moving between elements on the page', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const start = pageAwayEpoch()
    input.focus()
    input.blur()
    input.dispatchEvent(new FocusEvent('focus'))
    input.dispatchEvent(new FocusEvent('blur'))
    expect(pageAwayEpoch()).toBe(start)
    input.remove()
  })
})
