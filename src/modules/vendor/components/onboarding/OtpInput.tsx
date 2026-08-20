import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { OtpDigits } from '../../types/onboarding'

type OtpInputProps = {
  value: OtpDigits
  onChange: (value: OtpDigits) => void
  disabled?: boolean
  invalid?: boolean
}

export function OtpInput({ value, onChange, disabled, invalid }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const requestedFocusRef = useRef<number | null>(null)
  const digits = value

  const firstEmpty = () => {
    const index = digits.findIndex((digit) => !digit)
    return index === -1 ? 3 : index
  }

  const focusDigit = (index: number) => {
    const input = refs.current[index]
    if (!input) return
    if (document.activeElement !== input) {
      requestedFocusRef.current = index
      input.focus()
    }
    if (input.value) input.select()
  }

  const setDigit = (index: number, next: string) => {
    const digit = next.replace(/\D/g, '').slice(-1)
    const target = digit && index > firstEmpty() ? firstEmpty() : index
    const updated = [...digits] as OtpDigits
    updated[target] = digit
    onChange(updated)
    if (digit && target < 3) focusDigit(target + 1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const target = digits[index] || index === 0 ? index : index - 1
      const updated = [...digits] as OtpDigits
      updated[target] = ''
      onChange(updated)
      focusDigit(target)
      return
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      const updated = [...digits] as OtpDigits
      updated[index] = ''
      onChange(updated)
      return
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusDigit(index - 1)
    }
    if (event.key === 'ArrowRight' && index < 3) {
      event.preventDefault()
      focusDigit(index + 1)
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (!pasted) return
    const start = index > firstEmpty() ? firstEmpty() : index
    const updated = [...digits] as OtpDigits
    pasted.split('').forEach((digit, offset) => {
      if (start + offset < 4) updated[start + offset] = digit
    })
    onChange(updated)
    const nextEmpty = updated.findIndex((digit) => !digit)
    focusDigit(nextEmpty === -1 ? 3 : nextEmpty)
  }

  return (
    <div className="flex gap-2.5" aria-label="Four-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => { refs.current[index] = element }}
          id={`otp-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Code digit ${index + 1}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'otp-0-error' : undefined}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
          onPaste={(event) => onPaste(event, index)}
          onFocus={(event) => {
            if (requestedFocusRef.current === index) {
              requestedFocusRef.current = null
              return
            }
            requestedFocusRef.current = null
            const emptyIndex = firstEmpty()
            if (!digits[index] && index > emptyIndex) {
              focusDigit(emptyIndex)
              return
            }
            if (digit) event.currentTarget.select()
          }}
          className={cn(
            'size-12 rounded-lg border bg-card text-center font-display text-xl font-semibold outline-none transition sm:size-14 focus:border-primary focus:ring-3 focus:ring-primary/20',
            invalid ? 'border-destructive' : 'border-input',
          )}
        />
      ))}
    </div>
  )
}
