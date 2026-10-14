import { useEffect, useState } from 'react'
import { CircleCheck, MessageCircle } from 'lucide-react'
import { DEMO_OTP, isLiveApi, isValidMobile, OTP_LENGTH } from '@/shared/api'
import { Button } from '@/shared/components/ui'
import { useOnboardingStore } from '../../store/onboarding-store'
import type { ValidationIssue } from '../../types/onboarding'
import { FieldError } from './StepPrimitives'
import { OtpInput } from './OtpInput'

type StepProps = {
  issues: ValidationIssue[]
  busy: boolean
  statusMessage: string | null
  onContinue: () => void
}

// Steps 1 and 2 are the same job as /vendor/login, so they share its field, cells, button
// and link treatment (OtpLoginForm); only the wording speaks to a first-time vendor.
const linkClass =
  'rounded font-semibold text-[var(--md-green-700)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--md-green-600)] dark:text-[var(--md-green-500)]'

export function PhoneStep({ issues, busy, statusMessage, onContinue }: StepProps) {
  const phone = useOnboardingStore((state) => state.runtime.phone)
  const updatePhone = useOnboardingStore((state) => state.updatePhone)
  const invalid = issues.some((item) => item.field === 'phone')

  const changePhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    updatePhone(digits)
  }

  return (
    <div className="mx-auto w-full max-w-[24rem] pt-2">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onContinue()
        }}
      >
        <div
          className={
            'flex h-16 items-center rounded-2xl border bg-[var(--ob-sheet)] transition-colors focus-within:ring-4 motion-reduce:transition-none ' +
            (invalid
              ? 'border-destructive focus-within:ring-destructive/15'
              : 'border-slate-300 focus-within:border-[var(--md-green-600)] focus-within:ring-[var(--md-green-600)]/15 dark:border-[var(--ob-line)]')
          }
        >
          <MessageCircle className="mx-4 size-5 shrink-0 text-[var(--ob-ink-soft)]" aria-hidden />
          <span className="h-8 w-px shrink-0 bg-[var(--ob-line)]" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
            <label className="text-xs text-[var(--ob-ink-soft)]" htmlFor="phone">
              WhatsApp number
            </label>
            <div className="flex items-baseline gap-1.5 text-base font-medium tabular-nums">
              <span className="text-[var(--ob-ink-soft)]">+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                maxLength={10}
                disabled={busy}
                aria-invalid={invalid || undefined}
                aria-describedby={['phone-help', invalid ? 'phone-error' : null].filter(Boolean).join(' ')}
                placeholder="10-digit number"
                onChange={(event) => changePhone(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[var(--ob-ink)] caret-[var(--md-green-700)] outline-none placeholder:font-normal placeholder:normal-nums placeholder:text-[var(--ob-ink-soft)]"
              />
            </div>
          </div>
          {isValidMobile(phone) ? (
            <CircleCheck className="mr-4 size-5 shrink-0 fill-[var(--md-green-600)] text-white" aria-hidden />
          ) : null}
        </div>
        <FieldError issues={issues} field="phone" />
        <p id="phone-help" className="mt-2 text-sm text-[var(--ob-ink-soft)]">
          {isLiveApi()
            ? `We’ll send a ${OTP_LENGTH}-digit OTP to this number on WhatsApp.`
            : <>Demo mode: enter <strong className="font-semibold text-[var(--ob-ink)]">{DEMO_OTP}</strong> as the OTP.</>}
        </p>
        <Button type="submit" size="lg" fullWidth className="mt-6 h-12 rounded-xl" disabled={busy}>
          {busy ? 'Sending OTP…' : 'Send OTP'}
        </Button>
      </form>
      {statusMessage ? <p role="status" className={busy ? 'sr-only' : 'mt-4 text-sm font-medium text-[var(--ob-brand)]'}>{statusMessage}</p> : null}
    </div>
  )
}

export function OtpStep({
  issues,
  busy,
  statusMessage,
  onContinue,
  onResend,
}: StepProps & { onResend: () => Promise<boolean> }) {
  const otpDigits = useOnboardingStore((state) => state.runtime.otpDigits)
  const updateRuntime = useOnboardingStore((state) => state.updateRuntime)
  const [seconds, setSeconds] = useState(30)
  const [resending, setResending] = useState(false)
  const invalid = issues.some((item) => item.field === 'otp-0')

  useEffect(() => {
    if (seconds <= 0) return
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [seconds])

  const resend = async () => {
    setResending(true)
    try {
      if (await onResend()) setSeconds(30)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[24rem] pt-2">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onContinue()
        }}
      >
        <OtpInput
          value={otpDigits}
          onChange={(value) => updateRuntime({ otpDigits: value })}
          disabled={busy}
          invalid={invalid}
          describedBy="otp-sent-to"
        />
        <div className="text-center"><FieldError issues={issues} field="otp-0" /></div>
        {isLiveApi() ? null : (
          <p className="mt-2 text-center text-sm text-[var(--ob-ink-soft)]">
            Demo mode: enter <strong className="font-semibold text-[var(--ob-ink)]">{DEMO_OTP}</strong> as the OTP.
          </p>
        )}
        <Button type="submit" size="lg" fullWidth className="mt-6 h-12 rounded-xl" disabled={busy}>
          {busy && !resending ? 'Verifying…' : 'Verify & continue'}
        </Button>
        <p className="mt-5 text-center text-sm text-[var(--ob-ink-soft)]">
          Didn’t get it?{' '}
          <button
            type="button"
            className={`${linkClass} inline-flex min-h-11 items-center disabled:font-medium disabled:text-[var(--ob-ink-soft)] disabled:no-underline`}
            disabled={busy || seconds > 0}
            onClick={() => void resend()}
          >
            {seconds > 0 ? `Resend OTP in ${seconds}s` : resending ? 'Sending OTP…' : 'Resend OTP'}
          </button>
        </p>
      </form>

      {statusMessage ? <p role="status" className={busy ? 'sr-only' : 'mt-2 text-sm font-medium text-[var(--ob-brand)]'}>{statusMessage}</p> : null}
    </div>
  )
}

/** Step 2's lead under the wizard heading, worded and laid out as on /vendor/login. */
export function OtpSentTo({ busy, onChangePhone }: { busy: boolean; onChangePhone: () => void }) {
  const phone = useOnboardingStore((state) => state.runtime.phone)
  const maskedPhone = useOnboardingStore((state) => state.draft.maskedPhone)
  // The typed number lives only in memory; after a reload only the masked one survives.
  const shown = phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : maskedPhone

  return (
    <p id="otp-sent-to" className="mt-2 text-balance text-[0.9375rem] leading-relaxed text-[var(--ob-ink-soft)]">
      <span className="block">
        Sent on WhatsApp to{' '}
        <span className="whitespace-nowrap font-medium tabular-nums text-[var(--ob-ink)]">{shown ?? 'your number'}</span>
      </span>
      <button
        type="button"
        className={`${linkClass} inline-flex min-h-11 items-center disabled:text-[var(--ob-ink-soft)]`}
        disabled={busy}
        onClick={onChangePhone}
      >
        Change number
      </button>
    </p>
  )
}
