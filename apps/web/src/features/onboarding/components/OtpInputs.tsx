import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';

type OtpInputsProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
};

export function OtpInputs({
  length = 4,
  value,
  onChange,
  disabled,
  'aria-describedby': describedBy,
}: OtpInputsProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setAt(index: number, char: string) {
    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next.join('').replace(/\D/g, '').slice(0, length));
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="One-time password">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-describedby={describedBy}
          className={cn(
            'h-[3.25rem] w-11 rounded-xl border-2 border-gray-300 text-center text-xl font-bold outline-none transition focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.2)]',
            disabled && 'opacity-50',
          )}
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(index, char);
            if (char && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            if (pasted) onChange(pasted);
          }}
        />
      ))}
    </div>
  );
}
