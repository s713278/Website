import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, onClose, children }: Props) {
  return (
    <>
      <div
        className={`md-drawer-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`md-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        {children}
      </aside>
    </>
  );
}
