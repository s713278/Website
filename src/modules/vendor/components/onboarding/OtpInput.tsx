import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import type { OtpDigits } from '../../types/onboarding'

type OtpInputProps = {
  value: OtpDigits
  onChange: (value: OtpDigits) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}

export function OtpInput({ value, onChange, disabled, invalid, describedBy }: OtpInputProps) {
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
    <div role="group" className="grid grid-cols-4 gap-3" aria-label="4-digit OTP">
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
          aria-describedby={[describedBy, invalid ? 'otp-0-error' : null].filter(Boolean).join(' ') || undefined}
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
            // Matches the /vendor/login cells: Poppins digits, and selection hidden because the
            // focus ring already marks the cell the next digit replaces.
            'h-16 w-full min-w-0 rounded-2xl border bg-[var(--ob-sheet)] text-center font-display text-3xl font-semibold tabular-nums text-[var(--ob-ink)] caret-transparent outline-none transition-colors selection:bg-transparent motion-reduce:transition-none focus:border-[var(--md-green-600)] focus:ring-4 focus:ring-[var(--md-green-600)]/15',
            invalid ? 'border-destructive' : digit ? 'border-slate-400 dark:border-white/30' : 'border-slate-300 dark:border-[var(--ob-line)]',
          )}
        />
      ))}
    </div>
  )
}
