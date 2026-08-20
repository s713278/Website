import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  PaletteIcon,
  PlusIcon,
  StoreIcon,
  Trash2Icon,
  TypeIcon,
  UploadIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Input } from '@/shared/components/ui'
import { ACCENT_PRESETS, FONT_PRESETS, PRIMARY_PRESETS } from '@/shared/lib/theme'
import {
  ONBOARDING_THEME_PRESETS,
  storefrontPatchForPreset,
} from '../../data/onboarding-theme-presets'
import { readinessIssues } from '../../lib/onboarding-validation'
import { useOnboardingStore } from '../../store/onboarding-store'
import type {
  OnboardingStep,
  StorefrontButtonShape,
  StorefrontCardStyle,
  StorefrontDraft,
  ValidationIssue,
} from '../../types/onboarding'
import { FieldLabel } from './StepPrimitives'

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function ColorInput({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
          placeholder="#10B981"
        />
      </div>
      {error ? <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function PresetSwatches({
  label,
  presets,
  value,
  onChange,
}: {
  label: string
  presets: Array<{ id: string; label: string; color: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-label={`${label}: ${preset.label}`}
            aria-pressed={value.toLowerCase() === preset.color.toLowerCase()}
            title={preset.label}
            onClick={() => onChange(preset.color)}
            className={cn(
              'size-9 rounded-full border-2 border-background shadow-sm outline outline-1 outline-border transition focus-visible:ring-3 focus-visible:ring-primary/30',
              value.toLowerCase() === preset.color.toLowerCase() && 'ring-3 ring-primary/35 outline-primary',
            )}
            style={{ backgroundColor: preset.color }}
          />
        ))}
      </div>
    </div>
  )
}

function Disclosure({
  icon,
  title,
  children,
  open,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details className="group rounded-xl bg-muted/20 px-4 ring-1 ring-border/55" open={open}>
      <summary className="-mx-2 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-4 font-display text-sm font-semibold outline-none transition-colors hover:bg-muted/35 focus-visible:ring-3 focus-visible:ring-primary/25">
        <span className="flex items-center gap-2.5">{icon}{title}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      {children}
    </details>
  )
}

export function StorefrontStep({ issues }: { issues: ValidationIssue[] }) {
  const draft = useOnboardingStore((state) => state.draft)
  const runtime = useOnboardingStore((state) => state.runtime)
  const updateDraft = useOnboardingStore((state) => state.updateDraft)
  const updateRuntime = useOnboardingStore((state) => state.updateRuntime)
  const setImage = useOnboardingStore((state) => state.setImage)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const store = draft.storefront

  const updateStore = (patch: Partial<StorefrontDraft>, customTheme = false) => updateDraft(
    (current) => ({
      ...current,
      storefront: {
        ...current.storefront,
        ...patch,
        ...(customTheme ? { themePreset: null } : {}),
      },
    }),
    9,
  )

  const updateStoreName = (storeName: string) => updateDraft(
    (current) => ({
      ...current,
      business: { ...current.business, businessName: storeName },
      storefront: { ...current.storefront, storeName },
    }),
    9,
  )

  const handleImage = (kind: 'logo' | 'banner', event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const maxBytes = kind === 'logo' ? 500 * 1024 : 1024 * 1024
    const setError = kind === 'logo' ? setLogoError : setBannerError
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Use a PNG, JPEG, or WebP image. The previous valid preview is unchanged.')
      input.value = ''
      return
    }
    if (file.size > maxBytes) {
      setError(`${kind === 'logo' ? 'Logo' : 'Banner'} must be ${kind === 'logo' ? '500 KB' : '1 MB'} or smaller. The previous valid preview is unchanged.`)
      input.value = ''
      return
    }
    let objectUrl: string | null = null
    try {
      objectUrl = URL.createObjectURL(file)
      setImage(kind, file, objectUrl)
      setError(null)
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setError('This image could not be opened for preview. Choose another file.')
    } finally {
      input.value = ''
    }
  }

  const updateHeroBadge = (index: number, value: string) => {
    const heroBadges = [...store.heroBadges]
    heroBadges[index] = value
    updateStore({ heroBadges })
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl bg-muted/20 p-4 ring-1 ring-border/55" aria-labelledby="store-basics-heading">
        <div className="flex items-center gap-2.5">
          <StoreIcon className="size-4.5 text-primary" aria-hidden="true" />
          <h3 id="store-basics-heading" className="font-display font-semibold">Store basics</h3>
        </div>
        <div className="grid gap-4 @min-[32rem]:grid-cols-2">
          <Input id="store-name" label="Store name" value={store.storeName} minLength={3} maxLength={100} error={issues.find((item) => item.field === 'store-name')?.message} onChange={(event) => updateStoreName(event.target.value)} placeholder="Example: Lakshmi Home Foods" />
          <Input id="owner-name" label="Owner name" value={draft.business.ownerName} minLength={3} error={issues.find((item) => item.field === 'owner-name')?.message} onChange={(event) => updateDraft((current) => ({ ...current, business: { ...current.business, ownerName: event.target.value } }), 9)} placeholder="Full name" />
          <Input id="contact-person" label="Contact person" value={draft.business.contactPerson} minLength={3} error={issues.find((item) => item.field === 'contact-person')?.message} onChange={(event) => updateDraft((current) => ({ ...current, business: { ...current.business, contactPerson: event.target.value } }), 9)} placeholder="Who should customers speak with?" />
          <Input id="tagline" label="Tagline (optional)" value={store.tagline} maxLength={120} error={issues.find((item) => item.field === 'tagline')?.message} onChange={(event) => updateStore({ tagline: event.target.value })} />
          <Input id="business-location" label="Business location" value={store.businessLocation} maxLength={100} error={issues.find((item) => item.field === 'business-location')?.message} onChange={(event) => updateStore({ businessLocation: event.target.value })} placeholder="Hyderabad, Telangana" />
          <Input id="order-whatsapp" label="Order WhatsApp (E.164)" type="tel" value={runtime.orderWhatsapp} error={issues.find((item) => item.field === 'order-whatsapp')?.message} onChange={(event) => updateRuntime({ orderWhatsapp: event.target.value.replace(/[^+\d]/g, '').slice(0, 16) }, 9)} placeholder="+919876543210" autoComplete="tel" />
          <Input id="support-whatsapp" label="Support WhatsApp (optional)" type="tel" value={runtime.supportWhatsapp} error={issues.find((item) => item.field === 'support-whatsapp')?.message} onChange={(event) => updateRuntime({ supportWhatsapp: event.target.value.replace(/[^+\d]/g, '').slice(0, 16) }, 9)} placeholder="+919876543210" autoComplete="tel" />
          <div className="@min-[32rem]:col-span-2">
            <Input id="instagram" label="Instagram (optional)" value={store.instagram} maxLength={200} error={issues.find((item) => item.field === 'instagram')?.message} onChange={(event) => updateStore({ instagram: event.target.value })} placeholder="@yourstore or https://instagram.com/yourstore" />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-muted/20 p-4 ring-1 ring-border/55" aria-labelledby="theme-presets-heading">
        <div className="flex items-center gap-2.5">
          <PaletteIcon className="size-4.5 text-primary" aria-hidden="true" />
          <div>
            <h3 id="theme-presets-heading" className="font-display font-semibold">Theme presets</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">All presets use a light storefront background.</p>
          </div>
        </div>
        <div className="grid gap-2 @min-[32rem]:grid-cols-2">
          {ONBOARDING_THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={store.themePreset === preset.id}
              onClick={() => updateStore(storefrontPatchForPreset(preset))}
              className={cn(
                'flex items-center gap-3 rounded-xl bg-card/80 p-3 text-left outline-none ring-1 ring-border/65 transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-primary/25 active:scale-[0.99] motion-reduce:transform-none',
                store.themePreset === preset.id && 'bg-primary/[0.08] ring-primary/35 shadow-sm',
              )}
            >
              <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                <span className="size-7 rounded-full border-2 border-card" style={{ backgroundColor: preset.primaryColor }} />
                <span className="size-7 rounded-full border-2 border-card" style={{ backgroundColor: preset.accentColor }} />
              </span>
              <span className="min-w-0"><strong className="block text-sm">{preset.label}</strong><span className="block truncate text-xs text-muted-foreground">{preset.description}</span></span>
            </button>
          ))}
        </div>
      </section>

      <Disclosure title="Colors & typography" icon={<TypeIcon className="size-4.5 text-primary" aria-hidden="true" />} open>
        <div className="grid gap-4 pt-1 pb-5 @min-[32rem]:grid-cols-2">
          <ColorInput id="primary-color" label="Primary" value={store.primaryColor} error={issues.find((item) => item.field === 'primary-color')?.message} onChange={(primaryColor) => updateStore({ primaryColor }, true)} />
          <ColorInput id="accent-color" label="Accent" value={store.accentColor} error={issues.find((item) => item.field === 'accent-color')?.message} onChange={(accentColor) => updateStore({ accentColor }, true)} />
          <div className="@min-[32rem]:col-span-2">
            <PresetSwatches label="Primary presets" presets={PRIMARY_PRESETS} value={store.primaryColor} onChange={(primaryColor) => updateStore({ primaryColor }, true)} />
          </div>
          <div className="@min-[32rem]:col-span-2">
            <PresetSwatches label="Accent presets" presets={ACCENT_PRESETS} value={store.accentColor} onChange={(accentColor) => updateStore({ accentColor }, true)} />
          </div>
          <div className="@min-[32rem]:col-span-2">
            <FieldLabel>Font family</FieldLabel>
            <div className="grid gap-2 @min-[32rem]:grid-cols-3">
              {FONT_PRESETS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  aria-pressed={store.fontFamily === font.family}
                  onClick={() => updateStore({ fontFamily: font.family }, true)}
                  className={cn(
                    'rounded-xl bg-card/80 p-3 text-left outline-none ring-1 ring-border/60 transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-primary/25 active:scale-[0.99] motion-reduce:transform-none',
                    store.fontFamily === font.family && 'bg-primary/[0.09] text-foreground ring-primary/30 shadow-sm',
                  )}
                >
                  <strong className="block text-sm">{font.label}</strong><span className="text-xs text-muted-foreground">{font.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Buttons & cards" icon={<LayoutGridIcon className="size-4.5 text-primary" aria-hidden="true" />}>
        <div className="grid gap-4 pt-1 pb-5 @min-[32rem]:grid-cols-2">
          <div>
            <FieldLabel>Button shape</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(['PILL', 'ROUNDED', 'SQUARE'] as StorefrontButtonShape[]).map((value) => (
                <button key={value} type="button" aria-pressed={store.buttonShape === value} onClick={() => updateStore({ buttonShape: value })} className={cn('rounded-lg bg-card/80 px-3 py-2 text-sm capitalize outline-none ring-1 ring-border/60 transition-colors focus-visible:ring-3 focus-visible:ring-primary/25', store.buttonShape === value && 'bg-primary/[0.09] text-primary ring-primary/30')}>{value.toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Product cards</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(['BORDER', 'SHADOW', 'FLAT'] as StorefrontCardStyle[]).map((value) => (
                <button key={value} type="button" aria-pressed={store.cardStyle === value} onClick={() => updateStore({ cardStyle: value })} className={cn('rounded-lg bg-card/80 px-3 py-2 text-sm capitalize outline-none ring-1 ring-border/60 transition-colors focus-visible:ring-3 focus-visible:ring-primary/25', store.cardStyle === value && 'bg-primary/[0.09] text-primary ring-primary/30')}>{value.toLowerCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Messages & badges" icon={<MessageSquareIcon className="size-4.5 text-primary" aria-hidden="true" />}>
        <div className="space-y-5 pt-1 pb-5">
          <div className="grid gap-4 @min-[32rem]:grid-cols-2">
            <Input id="welcome-message" label="Welcome message (optional)" value={store.welcomeMessage} error={issues.find((item) => item.field === 'welcome-message')?.message} onChange={(event) => updateStore({ welcomeMessage: event.target.value })} maxLength={160} />
            <Input id="announcement-bar" label="Announcement bar (optional)" value={store.announcementBar} error={issues.find((item) => item.field === 'announcement-bar')?.message} onChange={(event) => updateStore({ announcementBar: event.target.value })} maxLength={100} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <FieldLabel>Hero badges</FieldLabel>
              <Button type="button" variant="ghost" size="sm" onClick={() => updateStore({ heroBadges: [...store.heroBadges, ''] })}><PlusIcon /> Add badge</Button>
            </div>
            <div className="space-y-2">
              {store.heroBadges.length ? store.heroBadges.map((badge, index) => (
                <div key={`hero-badge-${index}`} className="flex gap-2">
                  <input id={`hero-badge-${index}`} value={badge} maxLength={60} onChange={(event) => updateHeroBadge(index, event.target.value)} aria-label={`Hero badge ${index + 1}`} className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20" />
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove hero badge ${index + 1}`} onClick={() => updateStore({ heroBadges: store.heroBadges.filter((_, badgeIndex) => badgeIndex !== index) })}><Trash2Icon /></Button>
                </div>
              )) : <p className="text-xs text-muted-foreground">No hero badges added.</p>}
            </div>
          </div>

          <div>
            <FieldLabel>Trust strip</FieldLabel>
            <div className="grid gap-2 @min-[32rem]:grid-cols-2">
              {store.trustStrip.map((badge) => (
                <label key={badge.id} className="flex items-start gap-3 rounded-lg bg-card/75 p-3 ring-1 ring-border/55 transition-colors hover:bg-card">
                  <input type="checkbox" checked={badge.enabled} onChange={(event) => updateStore({ trustStrip: store.trustStrip.map((item) => item.id === badge.id ? { ...item, enabled: event.target.checked } : item) })} className="mt-1" />
                  <span><strong className="block text-sm">{badge.title}</strong><span className="text-xs text-muted-foreground">{badge.subtitle}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Logo & banner" icon={<ImageIcon className="size-4.5 text-primary" aria-hidden="true" />}>
        <div className="grid gap-4 pt-1 pb-5 @min-[32rem]:grid-cols-2">
          {(['logo', 'banner'] as const).map((kind) => {
            const isLogo = kind === 'logo'
            const inputRef = isLogo ? logoInputRef : bannerInputRef
            const file = isLogo ? runtime.logoFile : runtime.bannerFile
            const url = isLogo ? runtime.logoUrl : runtime.bannerUrl
            const error = isLogo ? logoError : bannerError
            return (
              <div key={kind} className="rounded-xl bg-card/75 p-4 ring-1 ring-border/55">
                <div className="mb-3 flex items-center gap-2"><ImageIcon className="size-4 text-primary" /><strong className="text-sm">{isLogo ? 'Logo' : 'Banner'}</strong></div>
                <input ref={inputRef} id={`store-${kind}-file`} type="file" aria-label={`Choose ${kind} image`} accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onClick={(event) => { event.currentTarget.value = '' }} onChange={(event) => handleImage(kind, event)} />
                <Button type="button" variant="outline" size="sm" aria-label={`Choose ${kind} image`} onClick={() => inputRef.current?.click()}><UploadIcon /> Choose image</Button>
                <p className="mt-2 text-xs text-muted-foreground">PNG, JPEG, or WebP · {isLogo ? '500 KB' : '1 MB'} max</p>
                {file ? <p className="mt-2 truncate text-xs font-medium">{file.name}</p> : null}
                {url ? <Button type="button" className="mt-2" variant="ghost" size="sm" onClick={() => setImage(kind, null, null)}>Remove</Button> : null}
                {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
              </div>
            )
          })}
          <p className="text-xs leading-5 text-muted-foreground @min-[32rem]:col-span-2">Images stay in this tab, are never uploaded by the prototype, and must be chosen again after reload.</p>
        </div>
      </Disclosure>
    </div>
  )
}

export function ReviewStep({ onGoToStep }: { onGoToStep: (step: OnboardingStep) => void }) {
  const draft = useOnboardingStore((state) => state.draft)
  const runtime = useOnboardingStore((state) => state.runtime)
  const issues = readinessIssues(draft, runtime)
  const completed =
    draft.publication.state === 'prototype-complete' &&
    draft.completedSteps.includes(10) &&
    Boolean(draft.publication.draftSlug)

  if (!completed) {
    return (
      <div className="space-y-5">
        <div className={cn('rounded-xl p-4', issues.length ? 'bg-amber-50/80 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100' : 'bg-primary/[0.07] text-foreground')}>
          <h3 className="font-display font-semibold">{issues.length ? `${issues.length} readiness item${issues.length === 1 ? '' : 's'} to resolve` : 'Ready to complete the local prototype'}</h3>
          <p className="mt-1 text-sm leading-6">{issues.length ? 'Each item links back to the step where it can be fixed.' : 'Continue creates a private browser preview. Nothing will be published.'}</p>
        </div>
        {issues.length ? (
          <ul className="space-y-2" aria-label="Readiness issues">
            {issues.map((item, index) => (
              <li key={`${item.step}-${item.field}-${index}`}>
                <button type="button" onClick={() => onGoToStep(item.step)} className="flex w-full items-start justify-between gap-3 rounded-lg bg-muted/35 p-3 text-left text-sm outline-none transition-colors hover:bg-muted/65 focus-visible:ring-3 focus-visible:ring-primary/25">
                  <span>{item.message}</span><span className="shrink-0 font-semibold text-primary">Step {item.step}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid gap-3 @min-[32rem]:grid-cols-2">
            {[
              ['Business type', draft.business.businessType?.name ?? 'Not selected'],
              ['Catalog', `${draft.categories.length} categories · ${draft.products.length} products`],
              ['Pricing', `${draft.skus.filter((sku) => sku.active).length} active SKUs`],
              ['Storefront', draft.storefront.storeName],
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/35 p-3"><span className="block text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary/[0.07] p-5 text-foreground">
        <CheckCircle2Icon className="size-7 text-primary" />
        <h3 className="mt-3 font-display text-xl font-semibold">Prototype complete. Not published.</h3>
        <p className="mt-2 text-sm leading-6">The private preview is saved in this browser. It can be restored here, but it is not a public storefront.</p>
      </div>
      <div className="rounded-xl bg-amber-50/80 p-4 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
        <h3 className="font-display text-sm font-semibold">Private fields are not stored</h3>
        <p className="mt-1 text-sm leading-6">Contact numbers, payment credentials, OTPs, and selected images must be entered again after reload.</p>
      </div>
      <Button asChild><Link to={`/onboarding/preview/${draft.publication.draftSlug}`}><ExternalLinkIcon /> Open private preview</Link></Button>
    </div>
  )
}
