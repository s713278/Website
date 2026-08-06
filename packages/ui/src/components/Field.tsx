import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Field({ label, id, className = '', ...rest }: Props) {
  return (
    <div className={className}>
      {label ? (
        <label className="md-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input id={id} className="md-field" {...rest} />
    </div>
  );
}
