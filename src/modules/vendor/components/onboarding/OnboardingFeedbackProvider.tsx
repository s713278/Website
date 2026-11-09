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
        timeout: tone === 'error' ? 6000 : 4000,
        priority: 'low',
      })
    },
    clear: () => manager.close(),
  }), [manager])

  return (
    <OnboardingFeedbackContext value={feedback}>
      {children}
      <Toaster toastManager={manager} limit={1} />
    </OnboardingFeedbackContext>
  )
}
