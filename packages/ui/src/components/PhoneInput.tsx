import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label?: string;
  countryCode?: string;
  onChange?: (digits: string) => void;
};

export function PhoneInput({
  label = 'Mobile Number',
  countryCode = '+91',
  value,
  onChange,
  id = 'phone',
  ...rest
}: Props) {
  return (
    <div>
      <label className="md-label" htmlFor={id}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select className="md-field" style={{ width: '5.5rem' }} aria-label="Country code" defaultValue={countryCode}>
          <option>+91</option>
        </select>
        <input
          id={id}
          className="md-field"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile"
          value={value}
          onChange={(e) => onChange?.(e.target.value.replace(/\D/g, '').slice(0, 10))}
          {...rest}
        />
      </div>
    </div>
  );
}
