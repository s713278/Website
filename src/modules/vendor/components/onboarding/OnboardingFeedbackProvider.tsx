import { useMemo, useState, type ReactNode } from 'react'
import { createToastManager, Toaster } from '@/components/ui/toast'
import { OnboardingFeedbackContext, type OnboardingFeedback } from './onboarding-feedback'

/** One transient action result for the wizard; persistent errors stay beside their fields. */
export function OnboardingFeedbackProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => createToastManager())
  const feedback = useMemo<OnboardingFeedback>(() => ({
    show: (message, tone) => {
      manager.add({
        id: 'onboarding-feedback',
        title: message,
        type: tone,
        timeout: tone === 'error' ? 5000 : 3000,
        priority: 'low',
      })
    },
    clear: () => manager.close(),
  }), [manager])

  return (
    <OnboardingFeedbackContext value={feedback}>
      {children}
      {/* The footer is 69px tall: a 5rem lift clears it. From 1400px the toast column sits right of
          the footer's Continue button (384px toast + 16px edge), so it can use the corner. */}
      <Toaster toastManager={manager} limit={1} viewportClassName="[--toast-lift:5rem] min-[1400px]:[--toast-lift:1rem]" />
    </OnboardingFeedbackContext>
  )
}
