import { useEffect, useState } from 'react'
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  InfoIcon,
  Loader2Icon,
  MessageCircleIcon,
  SmartphoneIcon,
} from 'lucide-react'
import { DEMO_OTP, isLiveApi } from '@/shared/api'
import { Button } from '@/shared/components/ui'
import { useOnboardingStore } from '../../store/onboarding-store'
import type { ValidationIssue } from '../../types/onboarding'
import { FieldError, FieldLabel, Hint } from './StepPrimitives'
import { OtpInput } from './OtpInput'

type StepProps = {
  issues: ValidationIssue[]
  busy: boolean
  statusMessage: string | null
  onContinue: () => void
}

/**
 * Shown at the navigation floor, in place of the identity steps it replaced.
 *
 * Once a number is verified there is nothing left for Steps 1-2 to ask, so they are
 * closed rather than left reachable and re-asking. This is purely informational — it
 * states whose draft is being edited. Leaving a setup is "Start over" in the header, the
 * single verb for a sign-out, so the notice no longer carries its own way out.
 */
export function VerifiedIdentityNotice() {
  const maskedPhone = useOnboardingStore((state) => state.draft.maskedPhone)

  return (
    <Hint tone="brand" icon={<CheckCircle2Icon className="size-4 text-[var(--ob-brand)]" />}>
      <p className="min-w-0 leading-5">
        <span className="font-semibold">Number verified. </span>
        {maskedPhone
          ? <>This setup belongs to <strong className="text-[var(--ob-ink)]">{maskedPhone}</strong>.</>
          : <>This setup belongs to the number you signed in with.</>}
      </p>
    </Hint>
  )
}

export function PhoneStep({ issues, busy, statusMessage, onContinue }: StepProps) {
  const phone = useOnboardingStore((state) => state.runtime.phone)
  const updatePhone = useOnboardingStore((state) => state.updatePhone)

  const changePhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    updatePhone(digits)
  }

  return (
    <div className="space-y-5">
      {/* Step 1 asks for exactly one thing, so the field is the whole screen rather
          than a small input under a stack of explanation. */}
      <form
        className="max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          onContinue()
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FieldLabel htmlFor="phone">WhatsApp mobile number</FieldLabel>
            <div className="flex overflow-hidden rounded-xl border border-[var(--ob-line)] bg-[var(--ob-sheet)] transition-[border-color,box-shadow] focus-within:border-[var(--ob-brand)] focus-within:ring-3 focus-within:ring-[var(--ob-brand-soft)]">
              <span className="ob-numeric grid min-w-14 place-items-center border-r border-[var(--ob-line)] bg-[var(--ob-canvas)] px-3 text-base font-semibold text-[var(--ob-ink-soft)]">
                +91
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                maxLength={10}
                disabled={busy}
                aria-invalid={issues.some((item) => item.field === 'phone') || undefined}
                aria-describedby={issues.some((item) => item.field === 'phone') ? 'phone-error' : undefined}
                placeholder="9876543210"
                onChange={(event) => changePhone(event.target.value)}
                className="ob-numeric h-14 min-w-0 flex-1 bg-transparent px-4 text-xl font-semibold tracking-[0.04em] text-[var(--ob-ink)] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[var(--ob-pending)]"
              />
            </div>
            <FieldError issues={issues} field="phone" />
          </div>
          <Button type="submit" className="h-14 shrink-0 px-6 sm:min-w-52" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            Send code on WhatsApp
            {!busy ? <ArrowRightIcon /> : null}
          </Button>
        </div>
      </form>

      <Hint icon={<MessageCircleIcon className="size-4" />}>
        {isLiveApi()
          ? 'We send a four-digit code to this number on WhatsApp. Standard messaging rates may apply.'
          : 'Demo mode is on, so no WhatsApp message is sent.'}
      </Hint>
      <Hint icon={<SmartphoneIcon className="size-4" />}>
        This becomes the number customers order on. Once it is verified, reaching a different
        number means signing out and starting setup again.
      </Hint>
      {statusMessage ? <p role="status" className="text-sm font-medium text-[var(--ob-brand)]">{statusMessage}</p> : null}
    </div>
  )
}

export function OtpStep({
  issues,
  busy,
  statusMessage,
  onContinue,
  onResend,
  onChangePhone,
}: StepProps & { onResend: () => Promise<boolean>; onChangePhone: () => void }) {
  const otpDigits = useOnboardingStore((state) => state.runtime.otpDigits)
  const maskedPhone = useOnboardingStore((state) => state.draft.maskedPhone)
  const updateRuntime = useOnboardingStore((state) => state.updateRuntime)
  const [seconds, setSeconds] = useState(30)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  const resend = async () => {
    if (await onResend()) setSeconds(30)
  }

  return (
    <div className="space-y-5">
      <Hint tone="brand" icon={<InfoIcon className="size-4 text-[var(--ob-brand)]" />}>
        <p className="font-semibold">{isLiveApi() ? 'Check WhatsApp' : 'Demo mode'}</p>
        <p className="mt-0.5 leading-5">
          {isLiveApi()
            ? <>We sent a four-digit code to {maskedPhone ?? 'your number'}. Enter it below to verify this number.</>
            : <>No WhatsApp was sent because demo mode is on. Enter <strong>{DEMO_OTP}</strong> to continue.</>}
        </p>
      </Hint>

      <form
        className="max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          onContinue()
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FieldLabel htmlFor="otp-0">Four-digit code</FieldLabel>
            <OtpInput
              value={otpDigits}
              onChange={(value) => updateRuntime({ otpDigits: value })}
              disabled={busy}
              invalid={issues.some((item) => item.field === 'otp-0')}
            />
            <FieldError issues={issues} field="otp-0" />
          </div>
          <Button type="submit" className="h-14 shrink-0 px-6 sm:min-w-48" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            Verify and continue
            {!busy ? <ArrowRightIcon /> : null}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="ghost" size="sm" onClick={onChangePhone}>
          Change number
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy || seconds > 0} onClick={() => void resend()}>
          Resend code
        </Button>
        <span className="text-[var(--ob-ink-soft)]" aria-live="polite">
          {seconds > 0 ? `Available in ${seconds}s` : 'Ready to resend'}
        </span>
      </div>

      {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
    </div>
  )
}
