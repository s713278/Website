import { useEffect, useState } from 'react'
import { InfoIcon, MessageCircleIcon, SmartphoneIcon } from 'lucide-react'
import { DEMO_OTP, isLiveApi } from '@/shared/api'
import { Button } from '@/shared/components/ui'
import { useOnboardingStore } from '../../store/onboarding-store'
import type { ValidationIssue } from '../../types/onboarding'
import { FieldError, FieldLabel } from './StepPrimitives'
import { OtpInput } from './OtpInput'

type StepProps = {
  issues: ValidationIssue[]
  busy: boolean
  statusMessage: string | null
}

export function PhoneStep({ issues, busy, statusMessage }: StepProps) {
  const phone = useOnboardingStore((state) => state.runtime.phone)
  const updatePhone = useOnboardingStore((state) => state.updatePhone)

  const changePhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    updatePhone(digits)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-primary/[0.06] p-3 text-sm text-foreground">
        <div className="flex gap-3">
          <SmartphoneIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="leading-5">Enter a 10-digit Indian mobile number. The country code is fixed to <strong>+91</strong>.</p>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="phone">WhatsApp mobile number</FieldLabel>
        <div className="flex rounded-lg border border-input bg-card focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
          <span className="grid min-w-16 place-items-center border-r px-3 text-sm font-semibold text-muted-foreground">+91</span>
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
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
          />
        </div>
        <FieldError issues={issues} field="phone" />
      </div>

      <div className="flex gap-3 rounded-lg bg-muted/35 p-3 text-sm leading-5 text-muted-foreground">
        <MessageCircleIcon className="mt-0.5 size-5 shrink-0" />
        <p>{isLiveApi() ? 'We send a four-digit code to this number on WhatsApp. Standard messaging rates may apply.' : 'Demo mode is on, so no WhatsApp message is sent.'}</p>
      </div>
      {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
    </div>
  )
}

export function OtpStep({ issues, busy, statusMessage, onResend }: StepProps & { onResend: () => Promise<boolean> }) {
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
    <div className="space-y-4">
      <div className="rounded-lg bg-primary/[0.06] p-3 text-sm text-foreground">
        <div className="flex gap-3">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">{isLiveApi() ? 'Check WhatsApp' : 'Demo mode'}</p>
            <p className="mt-1 leading-5">
              {isLiveApi()
                ? <>We sent a four-digit code to {maskedPhone ?? 'your number'}. Enter it below to verify this number.</>
                : <>No WhatsApp was sent because demo mode is on. Enter <strong>{DEMO_OTP}</strong> to continue.</>}
            </p>
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Four-digit code</FieldLabel>
        <OtpInput
          value={otpDigits}
          onChange={(value) => updateRuntime({ otpDigits: value })}
          disabled={busy}
          invalid={issues.some((item) => item.field === 'otp-0')}
        />
        <FieldError issues={issues} field="otp-0" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button variant="outline" size="sm" disabled={busy || seconds > 0} onClick={() => void resend()}>
          Resend code
        </Button>
        <span className="text-muted-foreground" aria-live="polite">
          {seconds > 0 ? `Available in ${seconds}s` : 'Ready to resend'}
        </span>
      </div>

      {statusMessage ? <p role="status" className="text-sm font-medium text-primary">{statusMessage}</p> : null}
    </div>
  )
}
