import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { env } from '@/shared/lib/env';
import { cn } from '@/shared/lib/utils';

const NAV_LINKS = [
  { to: '/#about', label: 'About Us' },
  { to: '/#explore', label: 'Search Stores' },
  { to: '/store', label: 'Store Demo' },
  { to: '/#features', label: 'Features' },
  { to: '/#pricing', label: 'Pricing' },
] as const;

const RESOURCE_LINKS = [
  { to: '/onboarding', label: 'Setup Guide', active: true },
  { to: '/#how-it-works', label: 'How It Works', active: false },
] as const;

export function OnboardingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const loadDemo = useOnboardingStore((s) => s.loadDemo);
  const menuId = useId();
  const resourcesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!resourcesRef.current?.contains(e.target as Node)) setResourcesOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label={`${env.VITE_APP_NAME} home`} className="shrink-0">
          <span className="font-display text-lg font-bold text-emerald-900">{env.VITE_APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-gray-700 hover:text-emerald-700"
            >
              {link.label}
            </Link>
          ))}
          <div className="relative" ref={resourcesRef}>
            <button
              type="button"
              className="text-sm font-medium text-gray-700 hover:text-emerald-700"
              aria-expanded={resourcesOpen}
              aria-haspopup="menu"
              onClick={() => setResourcesOpen((v) => !v)}
            >
              Resources ▾
            </button>
            {resourcesOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 min-w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-lg"
              >
                {RESOURCE_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    role="menuitem"
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm font-medium',
                      link.active
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-gray-700 hover:bg-gray-50',
                    )}
                    onClick={() => setResourcesOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Load demo data
          </button>
          <Link
            to="/auth/login"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Vendor Login
          </Link>
          <Link
            to="/onboarding"
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Get Started Free
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-gray-700 hover:bg-gray-50 lg:hidden"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>

      <div
        id={menuId}
        className={cn(
          'border-t border-gray-100 bg-white px-4 py-4 lg:hidden',
          menuOpen ? 'block' : 'hidden',
        )}
      >
        <nav className="grid gap-2" aria-label="Mobile">
          {[...NAV_LINKS, ...RESOURCE_LINKS].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => {
              loadDemo();
              setMenuOpen(false);
            }}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
          >
            Load demo data
          </button>
          <Link
            to="/auth/login"
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700"
            onClick={() => setMenuOpen(false)}
          >
            Vendor Login
          </Link>
          <Link
            to="/onboarding"
            className="rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
            onClick={() => setMenuOpen(false)}
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </header>
  );
}
