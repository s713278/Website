import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label?: string;
  onChange?: (otp: string) => void;
};

export function OtpInput({
  label = 'Enter OTP',
  value,
  onChange,
  id = 'otp',
  ...rest
}: Props) {
  return (
    <div>
      <label className="md-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="md-field"
        inputMode="numeric"
        maxLength={4}
        placeholder="••••"
        value={value}
        onChange={(e) => onChange?.(e.target.value.replace(/\D/g, '').slice(0, 4))}
        {...rest}
      />
    </div>
  );
}
