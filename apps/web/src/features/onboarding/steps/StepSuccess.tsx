import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FREE_PLAN_FEATURES, slugify } from '@/features/onboarding/data/constants';
import { useOnboardingStore } from '@/features/onboarding/store/onboarding-store';
import { cn } from '@/shared/lib/utils';

export function StepSuccess() {
  const settings = useOnboardingStore((s) => s.settings);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeSlug = slugify(settings.storeName || 'my-store');
  const storePath = `/store?vendor=${storeSlug}`;
  const storeUrl = useMemo(() => {
    if (typeof window === 'undefined') return `mithradirect.com${storePath}`;
    return `${window.location.origin}${storePath}`;
  }, [storePath]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const waShare = `https://wa.me/?text=${encodeURIComponent(
    `Order from ${settings.storeName || 'my shop'} — ${storeUrl}`,
  )}`;

  return (
    <section aria-labelledby="success-title" className="space-y-5">
      <div className="text-center">
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
          aria-hidden
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-emerald-700">
          {settings.storeName || 'Your store'} is live
        </p>
        <h2 id="success-title" className="font-display mt-1 text-xl font-bold text-gray-900">
          Congratulations! Setup complete
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Your Free plan is on. Next: share your shop link so customers can browse and order on
          WhatsApp.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white">
            Free plan
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Activated
          </span>
        </div>
        <p className="mt-2 font-semibold text-gray-900">Free tier is active on your store</p>
        <p className="mt-1 text-sm text-gray-600">
          No payment today · Just now ·{' '}
          <button
            type="button"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
            aria-expanded={featuresOpen}
            aria-controls="plan-features"
            onClick={() => setFeaturesOpen((v) => !v)}
          >
            What&apos;s included
          </button>
        </p>
        <ul
          id="plan-features"
          hidden={!featuresOpen}
          className={cn('mt-3 grid gap-2 sm:grid-cols-2', !featuresOpen && 'hidden')}
          aria-label="Included with Free plan"
        >
          {FREE_PLAN_FEATURES.map((f) => (
            <li
              key={f.code}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-gray-700"
            >
              <span aria-hidden>{f.icon}</span>
              <span>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 p-4">
        <h3 className="font-display text-base font-bold text-gray-900">
          Your shop link — how to use it
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          This is your online shop address. Customers open it to see products and place orders on
          WhatsApp.
        </p>
        <div className="mt-4 rounded-xl bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Copy this link
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
              {storeUrl}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Copy
            </button>
          </div>
          {copied ? (
            <p className="mt-2 text-xs text-emerald-700" role="status">
              Link copied — paste it in WhatsApp or your Instagram bio.
            </p>
          ) : null}
        </div>

        <ol className="mt-5 space-y-4" aria-label="How to get your first orders">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              1
            </span>
            <div>
              <strong className="text-gray-900">Open your shop once</strong>
              <p className="text-sm text-gray-500">Check products, prices, and WhatsApp look right.</p>
              <Link to={storePath} className="mt-1 inline-block text-sm font-semibold text-emerald-700">
                Preview my shop →
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              2
            </span>
            <div>
              <strong className="text-gray-900">Send on WhatsApp</strong>
              <p className="text-sm text-gray-500">Message regular customers with your shop link.</p>
              <a
                href={waShare}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-semibold text-emerald-700"
              >
                Share on WhatsApp →
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              3
            </span>
            <div>
              <strong className="text-gray-900">Add to Instagram bio</strong>
              <p className="text-sm text-gray-500">Paste the link so followers can shop anytime.</p>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="mt-1 text-sm font-semibold text-emerald-700"
              >
                Copy link for bio
              </button>
            </div>
          </li>
        </ol>
      </div>

      <div className="space-y-2">
        <Link
          to="/dashboard"
          className="block w-full rounded-full bg-emerald-500 py-3 text-center text-sm font-bold text-white hover:bg-emerald-600"
        >
          Go to Dashboard
        </Link>
        <Link
          to="/#pricing"
          className="block text-center text-sm font-medium text-gray-500 hover:text-emerald-700"
        >
          View plans &amp; upgrade later
        </Link>
      </div>
      <p className="text-center text-xs text-gray-400">
        Share when you&apos;re ready — your Free plan stays active either way.
      </p>
    </section>
  );
}
