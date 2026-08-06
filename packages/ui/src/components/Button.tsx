import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'wa';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'md' | 'sm';
  asChild?: boolean;
  children: ReactNode;
};

const variantClass: Record<Variant, string> = {
  primary: 'md-btn md-btn-primary',
  outline: 'md-btn md-btn-outline',
  wa: 'md-btn md-btn-wa',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const sizeClass = size === 'sm' ? 'md-btn-sm' : '';
  return (
    <button type="button" className={`${variantClass[variant]} ${sizeClass} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}
