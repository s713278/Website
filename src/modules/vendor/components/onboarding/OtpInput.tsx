import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import type { OtpDigits } from '../../types/onboarding'

type OtpInputProps = {
  value: OtpDigits
  onChange: (value: OtpDigits) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

export function OtpInput({ value, onChange, disabled, invalid, describedBy }: OtpInputProps) {
  const code = value.join('')

  return (
    <InputOTP
      // `otp-0` stays the field id so validation issues can still focus the code.
      id="otp-0"
      maxLength={4}
      pattern={REGEXP_ONLY_DIGITS}
      value={code}
      onChange={(next) => onChange(Array.from({ length: 4 }, (_, index) => next[index] ?? '') as OtpDigits)}
      disabled={disabled}
      aria-label="4-digit OTP"
      aria-invalid={invalid || undefined}
      aria-describedby={[describedBy, invalid ? 'otp-0-error' : null].filter(Boolean).join(' ') || undefined}
      containerClassName="justify-center"
      // Password managers never store OTPs; their badge probe would only resize the field.
      pushPasswordManagerStrategy="none"
    >
      <InputOTPGroup>
        {value.map((_, index) => (
          <InputOTPSlot key={index} index={index} aria-invalid={invalid || undefined} className="size-13 text-xl" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
