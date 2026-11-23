import { createContext, useContext } from 'react'

export type FeedbackTone = 'warning' | 'error' | 'success'
export type OnboardingFeedback = {
  show: (message: string, tone: FeedbackTone) => void
  clear: () => void
}

export const OnboardingFeedbackContext = createContext<OnboardingFeedback | null>(null)

export function useOnboardingFeedback() {
  const feedback = useContext(OnboardingFeedbackContext)
  if (!feedback) throw new Error('Onboarding feedback requires OnboardingFeedbackProvider')
  return feedback
}
