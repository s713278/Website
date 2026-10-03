import { ArrowRight, ExternalLink, Globe, MapPin, Phone, User } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { mapsEmbedUrl, mapsSearchUrl, supportHelpMessage } from '@/modules/storefront/lib/store-contact'
import { whatsappHref } from '@/modules/storefront/lib/whatsapp-order'
import {
  hasStoreContactContent,
  type StoreContact,
  type StoreContactAddress,
  type StoreContactLink,
} from '@/shared/api'
import { WhatsAppIcon } from './WhatsAppIcon'

type StoreContactBlockProps = {
  contact: StoreContact
  className?: string
}

function InstagramIcon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16.162a4.162 4.162 0 1 1 0-8.324 4.162 4.162 0 0 1 0 8.324zm7.846-10.405a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"
      />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#fff" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function SocialGlyph({ platform }: { platform: string }) {
  const key = platform.toUpperCase()
  if (key === 'INSTAGRAM') return <InstagramIcon className="size-6" />
  if (key === 'YOUTUBE') return <YouTubeIcon className="size-6" />
  if (key === 'WHATSAPP') return <WhatsAppIcon className="size-6" />
  return <Globe className="size-6" aria-hidden />
}

function Fact({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode
  label: string
  value: string
  href?: string
}) {
  const body = (
    <>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-slate-400">{label}</span>
        <span className="block truncate text-sm font-semibold text-slate-800">{value}</span>
      </span>
    </>
  )
  const className = 'flex min-w-0 items-center gap-2.5'
  if (!href) return <div className={className}>{body}</div>
  return (
    <a href={href} className={cn(className, 'rounded-xl transition hover:text-emerald-700')}>
      {body}
    </a>
  )
}

function AddressColumn({
  title,
  lines,
}: {
  title: string
  lines: string[]
}) {
  if (!title && !lines.length) return null
  return (
    <div className="flex min-w-0 gap-2.5">
      <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {lines.map((line, index) => (
          <p key={`${index}-${line}`} className="text-sm leading-snug text-slate-500">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

function platformLabel(platform: string) {
  const key = platform.trim().toUpperCase()
  if (key === 'INSTAGRAM') return 'Instagram'
  if (key === 'YOUTUBE') return 'YouTube'
  if (key === 'WHATSAPP') return 'WhatsApp'
  const lower = key.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function formatContactNumber(raw: string) {
  const dial = raw.replace(/\D/g, '')
  if (dial.length === 12 && dial.startsWith('91')) {
    const local = dial.slice(2)
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`
  }
  if (dial.length === 10) return `+91 ${dial.slice(0, 5)} ${dial.slice(5)}`
  if (dial.length > 10) return `+${dial}`
  return raw.trim()
}

function phoneLinks(contactNumber: string | undefined, businessName: string): {
  display?: string
  callHref?: string
  whatsappHref?: string
} {
  const dial = contactNumber?.replace(/\D/g, '') ?? ''
  if (dial.length < 10) return {}
  const withCountry = dial.length === 10 ? `91${dial}` : dial
  return {
    display: formatContactNumber(contactNumber ?? ''),
    callHref: `tel:+${withCountry}`,
    whatsappHref: whatsappHref(withCountry, supportHelpMessage(businessName)),
  }
}

function mapPoint(address: StoreContactAddress) {
  const label = [
    address.address1,
    address.address2,
    address.locality,
    address.district,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')
  return {
    label: label || undefined,
    latitude: address.latitude,
    longitude: address.longitude,
  }
}

function addressColumns(address: StoreContactAddress) {
  const street = [address.address1, address.address2].filter((line): line is string => Boolean(line))
  const place = [address.state, address.country].filter(Boolean).join(', ')
  const pin = address.zipCode ? `PIN: ${address.zipCode}` : undefined
  const columns: { title: string; lines: string[] }[] = []

  if (street.length) columns.push({ title: 'Main address', lines: street })
  if (address.locality && address.district) {
    columns.push({ title: address.locality, lines: [address.district] })
  } else if (address.locality || address.district) {
    columns.push({ title: address.locality ?? address.district ?? '', lines: [] })
  }
  if (address.city || place || pin) {
    columns.push({
      title: address.city ?? 'Location',
      lines: [place, pin].filter((line): line is string => Boolean(line)),
    })
  }
  return columns
}

function mapCaption(address: StoreContactAddress) {
  return [address.address1, address.address2, address.locality].filter(Boolean).join(', ') || undefined
}

function socialClass(platform: string) {
  const key = platform.toUpperCase()
  if (key === 'INSTAGRAM') return 'bg-[#f7edff] hover:bg-[#f0e2ff]'
  if (key === 'YOUTUBE') return 'bg-[#ffefef] hover:bg-[#ffe4e4]'
  return 'bg-slate-50 hover:bg-slate-100'
}

function SocialButton({ link }: { link: StoreContactLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex min-h-12 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 transition',
        socialClass(link.platform),
      )}
    >
      <SocialGlyph platform={link.platform} />
      {platformLabel(link.platform)}
      <ArrowRight className="size-4 text-slate-500" aria-hidden />
    </a>
  )
}

/** Contact card laid out from the contact-us payload. */
export function StoreContactBlock({ contact, className }: StoreContactBlockProps) {
  if (!hasStoreContactContent(contact)) return null

  const address = contact.mainAddress
  const columns = address ? addressColumns(address) : []
  const caption = address ? mapCaption(address) : undefined
  const point = address ? mapPoint(address) : undefined
  const embedUrl = point ? mapsEmbedUrl(point) : undefined
  const searchUrl = point ? mapsSearchUrl(point) : undefined
  const phone = phoneLinks(contact.contactNumber, contact.businessName)

  return (
    <div className={cn('grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.9fr)]', className)}>
      <article className="overflow-hidden rounded-[1.75rem] border border-white bg-white p-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.28)] sm:p-6">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <MapPin className="size-3.5" aria-hidden />
          Our store
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {contact.ownerName ? (
            <Fact icon={<User className="size-4" aria-hidden />} label="Owner" value={contact.ownerName} />
          ) : null}
          {phone.display ? (
            <Fact
              icon={<Phone className="size-4" aria-hidden />}
              label="Contact number"
              value={phone.display}
              href={phone.callHref}
            />
          ) : null}
          {contact.storeIdentifier ? (
            <Fact
              icon={<MapPin className="size-4" aria-hidden />}
              label="Store identifier"
              value={contact.storeIdentifier}
            />
          ) : null}
        </div>

        {embedUrl && searchUrl ? (
          <div className="relative mt-5 overflow-hidden rounded-2xl bg-slate-100">
            <iframe
              title={`Map of ${contact.businessName}`}
              src={embedUrl}
              className="h-64 w-full border-0 sm:h-72"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {caption ? (
              <div className="pointer-events-none absolute left-3 top-3 max-w-[16rem] rounded-xl bg-white/95 px-3 py-2 shadow-md ring-1 ring-slate-200/80">
                <p className="text-sm font-semibold text-slate-900">{contact.businessName}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{caption}</p>
              </div>
            ) : null}
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-3 left-1/2 inline-flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700"
            >
              Open in Maps
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        ) : null}

        {columns.length ? (
          <div className="mt-4 grid gap-4 rounded-2xl bg-[#f3fbf6] px-4 py-4 sm:grid-cols-3">
            {columns.map((column) => (
              <AddressColumn key={column.title} title={column.title} lines={column.lines} />
            ))}
          </div>
        ) : null}

        {contact.addresses.length ? (
          <div className="mt-4 space-y-3">
            {contact.addresses.map((extra, index) => (
              <div key={`${extra.address1 ?? ''}-${extra.city ?? ''}-${index}`} className="rounded-2xl bg-[#f3fbf6] px-4 py-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {addressColumns(extra).map((column) => (
                    <AddressColumn key={`${column.title}-${index}`} title={column.title} lines={column.lines} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </article>

      <div className="grid gap-4">
        {phone.whatsappHref ? (
          <section className="rounded-[1.75rem] border border-emerald-100 bg-[#f3fbf6] px-5 py-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <WhatsAppIcon className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Need help?</h2>
                <p className="mt-0.5 text-sm text-slate-500">Chat with us on WhatsApp for quick support.</p>
              </div>
            </div>
            <a
              href={phone.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <WhatsAppIcon className="size-4" />
              Chat on WhatsApp
              <ArrowRight className="size-4" aria-hidden />
            </a>
          </section>
        ) : null}

        {contact.socialLinks.length ? (
          <section className="rounded-[1.75rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.2)]">
            <h2 className="text-lg font-bold text-slate-900">Follow us on</h2>
            <p className="mt-0.5 text-sm text-slate-500">Stay connected for updates.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.socialLinks.map((link) => (
                <SocialButton key={link.id} link={link} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
