import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import logoLightMd from '@/assets/logo_light_md.png'
import { InstagramLogo, WhatsAppLogo, YouTubeLogo } from './ChannelLogos'

const footerGroups = [
  {
    title: 'Products',
    links: [
      ['Vendor Onboarding', '/onboarding'],
      // Hidden for the first production phase. Rename the label (e.g. 'Browse Stores') before restoring.
      // ['Demo Storefront', '/stores'],
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
      ['Partner With Us', 'mailto:mithradirect@gmail.com'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['Support', 'mailto:mithradirect@gmail.com?subject=Support'],
      ['Privacy Policy', 'mailto:mithradirect@gmail.com?subject=Privacy'],
      ['Terms & Conditions', 'mailto:mithradirect@gmail.com?subject=Terms'],
    ],
  },
]

const socials: { label: string; href: string; Logo: ComponentType<{ className?: string; tone?: 'current' }> }[] = [
  { label: 'MithraDirect on Instagram', href: 'https://www.instagram.com/mithradirect/', Logo: InstagramLogo },
  { label: 'MithraDirect on YouTube', href: 'https://www.youtube.com/@MithraDirect', Logo: YouTubeLogo },
  { label: 'Chat with MithraDirect on WhatsApp', href: 'https://wa.me/919912149049', Logo: WhatsAppLogo },
]

const focusRing =
  'rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300'

export function MarketingFooter() {
  return (
    <footer className="marketing-gutter bg-[#0b1220] pt-12 pb-6 text-sm text-slate-400">
      <div className="marketing-measure">
        {/* Phones put the brand on its own row and the link groups two across; from `md` everything
            shares one row, as in the design reference. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-x-8">
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <Link to="/" aria-label="MithraDirect home" className={`inline-block ${focusRing}`}>
              <img
                src={logoLightMd}
                alt="MithraDirect — Shop Local, Support Local, Grow Together"
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-3 max-w-72 leading-6 text-pretty">
              India’s hyperlocal commerce platform for neighbourhood businesses — Instagram ready,
              WhatsApp first, zero commission.
            </p>
            <ul className="mt-4 flex gap-2.5">
              {socials.map(({ label, href, Logo }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-full bg-white/6 text-slate-300 transition-colors hover:bg-emerald-500/35 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <Logo tone="current" className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {footerGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="font-display text-[0.95rem] font-semibold text-white">{group.title}</h2>
              <ul className="mt-3 space-y-2 leading-6">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <Link to={href} className={`transition-colors hover:text-emerald-200 ${focusRing}`}>
                        {label}
                      </Link>
                    ) : (
                      <a href={href} className={`transition-colors hover:text-emerald-200 ${focusRing}`}>
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-9 flex flex-col gap-1 border-t border-white/8 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MithraDirect. All rights reserved.</p>
          <p>Made for India’s local businesses</p>
        </div>
      </div>
    </footer>
  )
}
