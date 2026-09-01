import { Camera, Mail, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import logoDarkMd from '@/assets/logo_dark_md.png'

const footerGroups = [
  {
    title: 'Products',
    links: [
      ['Vendor Onboarding', '/onboarding'],
      ['Demo Storefront', '/stores'],
      ['Features', '#features'],
      ['Pricing', '#pricing'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About Us', '#about'],
      ['Stories', '#testimonials'],
      ['Why MithraDirect', '#comparison'],
      ['Partner With Us', 'mailto:hello@mithradirect.com'],
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="bg-slate-950 px-4 py-14 text-slate-300 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-[1.35fr_0.85fr_0.85fr_1.15fr]">
          <div>
            <Link
              to="/"
              aria-label="MithraDirect home"
              className="inline-block rounded-xl bg-white px-3 py-2"
            >
              <img
                src={logoDarkMd}
                alt="MithraDirect — Shop Local, Support Local, Grow Together"
                className="h-12 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-sm leading-7 text-slate-400">
              India’s hyperlocal commerce platform for neighbourhood businesses — Instagram ready,
              WhatsApp first, zero commission.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="https://www.instagram.com/mithradirect/"
                target="_blank"
                rel="noreferrer"
                aria-label="MithraDirect on Instagram"
                className="flex size-11 items-center justify-center rounded-full bg-slate-800 transition hover:bg-emerald-600"
              >
                <Camera className="size-5" aria-hidden />
              </a>
              <a
                href="https://www.youtube.com/@MithraDirect"
                target="_blank"
                rel="noreferrer"
                aria-label="MithraDirect on YouTube"
                className="flex size-11 items-center justify-center rounded-full bg-slate-800 transition hover:bg-emerald-600"
              >
                <Play className="size-5 fill-current" aria-hidden />
              </a>
              <a
                href="mailto:hello@mithradirect.com"
                aria-label="Email MithraDirect"
                className="flex size-11 items-center justify-center rounded-full bg-slate-800 transition hover:bg-emerald-600"
              >
                <Mail className="size-5" aria-hidden />
              </a>
            </div>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-display font-bold text-white">{group.title}</h2>
              <ul className="mt-4 space-y-3 text-slate-400">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <Link to={href} className="transition hover:text-emerald-400">
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className="transition hover:text-emerald-400">
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="font-display font-bold text-white">Stay Connected</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="marketing-email">
                Email address
              </label>
              <input
                id="marketing-email"
                type="email"
                placeholder="Enter your email"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-emerald-500"
              />
              <button
                type="button"
                className="rounded-full bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-500"
              >
                Subscribe
              </button>
            </div>
            <nav aria-label="Legal" className="mt-6 flex flex-col gap-3 text-slate-400">
              <a
                href="mailto:hello@mithradirect.com?subject=Privacy"
                className="hover:text-emerald-400"
              >
                Privacy Policy
              </a>
              <a
                href="mailto:hello@mithradirect.com?subject=Terms"
                className="hover:text-emerald-400"
              >
                Terms & Conditions
              </a>
              <a
                href="mailto:hello@mithradirect.com?subject=Support"
                className="hover:text-emerald-400"
              >
                Support
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MithraDirect. All rights reserved.</p>
          <p>Made for India’s local businesses</p>
        </div>
      </div>
    </footer>
  )
}
