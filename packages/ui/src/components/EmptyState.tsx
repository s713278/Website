import type { ReactNode } from 'react';
import { Button } from './Button';

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function EmptyState({
  title,
  description,
  icon,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <div className="md-empty md-fade-in">
      {icon ? <div style={{ fontSize: '2.5rem' }}>{icon}</div> : null}
      <h1 className="md-display">{title}</h1>
      {description ? <p style={{ color: 'var(--store-muted)' }}>{description}</p> : null}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
        {primaryLabel && onPrimary ? (
          <Button onClick={onPrimary}>{primaryLabel}</Button>
        ) : null}
        {secondaryLabel && onSecondary ? (
          <Button variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
