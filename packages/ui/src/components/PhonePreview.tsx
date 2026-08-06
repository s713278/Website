import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function PhonePreview({ children }: Props) {
  return <div className="md-phone-preview">{children}</div>;
}
