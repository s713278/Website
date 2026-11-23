// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { OnboardingStep } from '../../types/onboarding'
import { OnboardingStepper } from './OnboardingStepper'

// jsdom has no element scrolling; the stepper centres the current step with it.
let scrollTo: PropertyDescriptor | undefined
beforeEach(() => {
  scrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
})
afterEach(() => {
  cleanup()
  if (scrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollTo)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
})

const ALL_DONE: OnboardingStep[] = [1, 2, 3, 4, 5, 6, 7, 8]

function renderStepper(props: Partial<Parameters<typeof OnboardingStepper>[0]> = {}) {
  render(
    <OnboardingStepper
      currentStep={9}
      completedSteps={ALL_DONE}
      furthestVisitedStep={9}
      firstNavigableStep={3}
      onNavigate={vi.fn()}
      {...props}
    />,
  )
}

const stepButton = (step: number) => screen.getByRole('button', { name: new RegExp(`^Step ${step},`) })

describe('the Needs attention marker', () => {
  it('names a done step with missing work as needing attention, in its label and title, with no text in the bar', () => {
    renderStepper({ attentionSteps: [5, 6] })

    for (const step of [5, 6]) {
      const button = stepButton(step)
      expect(button.getAttribute('aria-label')).toMatch(/needs attention/i)
      expect(button.getAttribute('title')).toMatch(/needs attention/i)
      expect(button.querySelector('[data-attention-badge]')).not.toBeNull()
      // Still reachable: the marker never locks a step.
      expect(button.matches(':disabled')).toBe(false)
    }
    expect(stepButton(4).getAttribute('aria-label')).not.toMatch(/needs attention/i)
    expect(stepButton(4).querySelector('[data-attention-badge]')).toBeNull()
    expect(screen.queryByText(/needs attention/i)).toBeNull()
  })

  it('marks the current step too, keeping it the current step', () => {
    renderStepper({ currentStep: 5, attentionSteps: [5] })

    const button = stepButton(5)
    expect(button.getAttribute('aria-current')).toBe('step')
    expect(button.getAttribute('aria-label')).toMatch(/You are here.*needs attention/i)
    expect(button.querySelector('[data-attention-badge]')).not.toBeNull()
  })

  it('never marks a step the vendor cannot reach yet', () => {
    renderStepper({ currentStep: 4, completedSteps: [1, 2, 3], furthestVisitedStep: 4, attentionSteps: [5, 6] })

    expect(stepButton(5).getAttribute('aria-label')).not.toMatch(/needs attention/i)
    expect(stepButton(5).querySelector('[data-attention-badge]')).toBeNull()
  })

  it('keeps the additive marker for a submitted store’s catalog steps', () => {
    renderStepper({ currentStep: 10, completedSteps: [...ALL_DONE, 9], furthestVisitedStep: 10, catalogAdditiveOpen: true })

    expect(stepButton(4).getAttribute('aria-label')).toMatch(/You can still add here/)
    expect(stepButton(4).querySelector('[data-attention-badge]')).toBeNull()
  })
})
