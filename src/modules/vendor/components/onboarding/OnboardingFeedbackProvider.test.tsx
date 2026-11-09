// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OnboardingFeedbackProvider } from './OnboardingFeedbackProvider'
import { useOnboardingFeedback } from './onboarding-feedback'

function Actions() {
  const feedback = useOnboardingFeedback()
  return <>
    <button onClick={() => feedback.show('Already saved.', 'warning')}>Warn</button>
    <button onClick={() => feedback.show('Select a product.', 'error')}>Fail</button>
    <button onClick={() => feedback.show('Changes saved.', 'success')}>Save</button>
  </>
}

const activeToast = () => document.querySelector('[data-slot="toast"]:not([data-ending-style])')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('onboarding action feedback', () => {
  it('replaces the previous result, with regular-weight text and semantic colors', () => {
    render(<OnboardingFeedbackProvider><Actions /></OnboardingFeedbackProvider>)
    fireEvent.click(screen.getByText('Warn'))
    expect(activeToast()?.className).toContain('bg-amber-50')
    fireEvent.click(screen.getByText('Fail'))
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1)
    expect(activeToast()?.textContent).toContain('Select a product.')
    expect(activeToast()?.className).toContain('text-destructive')
    fireEvent.click(screen.getByText('Save'))
    expect(activeToast()?.className).toContain('bg-emerald-50')
    expect(activeToast()?.querySelector('[data-slot="toast-title"]')?.className).toContain('font-normal')
  })

  it.each([
    ['Warn', 4000],
    ['Save', 4000],
    ['Fail', 6000],
  ])('expires %s feedback after %i ms', (action, timeout) => {
    vi.useFakeTimers()
    render(<OnboardingFeedbackProvider><Actions /></OnboardingFeedbackProvider>)
    fireEvent.click(screen.getByText(action))
    act(() => vi.advanceTimersByTime(Number(timeout) - 1))
    expect(activeToast()).not.toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(activeToast()).toBeNull()
  })
})
