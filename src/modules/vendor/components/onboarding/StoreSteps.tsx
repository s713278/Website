import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  LayoutGridIcon,
  MessageSquareIcon,
  QrCodeIcon,
  PlusIcon,
  Trash2Icon,
  TypeIcon,
  UploadIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isLiveApi } from '@/shared/api'
import { Button, Input } from '@/shared/components/ui'
import { ACCENT_PRESETS, FONT_PRESETS, PRIMARY_PRESETS } from '@/shared/lib/theme'
import {
  ONBOARDING_THEME_PRESETS,
  storefrontPatchForPreset,
} from '../../data/onboarding-theme-presets'
import { readinessIssues } from '../../lib/onboarding-validation'
import { StepNotice } from './AccessNotice'
import {
  selectCategoryLimit,
  selectProductLimit,
  selectSkuLimit,
  useOnboardingStore,
} from '../../store/onboarding-store'
import type {
  StoreSubmission,
  OnboardingStep,
  StorefrontButtonShape,
  StorefrontCardStyle,
  StorefrontDraft,
  ValidationIssue,
} from '../../types/onboarding'
import { FieldLabel, StepSection } from './StepPrimitives'

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
          className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-3 font-mono text-sm uppercase outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]"
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
    <details className="group mt-6 border-t border-[var(--ob-line)]" open={open}>
      <summary className="-mx-2 flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-4 font-display text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--ob-ink)] outline-none transition-colors hover:text-[var(--ob-brand)] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]">
        <span className="flex items-center gap-2.5">{icon}{title}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-[var(--ob-ink-soft)] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
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
    <div>
      {/*
        Step 9 is written to the account like every other step, but it is the only one
        that cannot be read back: the storefront read 404s until an admin approves the
        store. Saying so here stops a returning vendor concluding their branding was
        never saved. See docs/API_GAPS.md.
      */}
      {isLiveApi() ? (
        <div className="mb-6">
          <StepNotice message="Your store details are sent to your store, but we cannot read them back until MithraDirect approves it — so this step starts from defaults each time you return. Check these fields before continuing." />
        </div>
      ) : null}
      <StepSection
        id="store-basics"
        title="Store basics"
        description="What customers see first, and how they reach you."
      >
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
      </StepSection>

      <StepSection
        id="theme-presets"
        title="Theme presets"
        description="A ready-made look for your shop. All presets use a light storefront background."
      >
        <div className="grid gap-2 @min-[32rem]:grid-cols-2">
          {ONBOARDING_THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={store.themePreset === preset.id}
              onClick={() => updateStore(storefrontPatchForPreset(preset))}
              className={cn(
                'flex items-center gap-3 rounded-xl bg-[var(--ob-sheet)] p-3 text-left outline-none ring-1 ring-[var(--ob-line)] transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)] active:scale-[0.99] motion-reduce:transform-none',
                store.themePreset === preset.id && 'bg-primary/[0.08] ring-[var(--ob-brand)]/40',
              )}
            >
              <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                <span className="size-7 rounded-full border-2 border-[var(--ob-sheet)]" style={{ backgroundColor: preset.primaryColor }} />
                <span className="size-7 rounded-full border-2 border-[var(--ob-sheet)]" style={{ backgroundColor: preset.accentColor }} />
              </span>
              <span className="min-w-0"><strong className="block text-sm">{preset.label}</strong><span className="block truncate text-xs text-[var(--ob-ink-soft)]">{preset.description}</span></span>
            </button>
          ))}
        </div>
      </StepSection>

      <Disclosure title="Colors & typography" icon={<TypeIcon className="size-4.5 text-[var(--ob-brand)]" aria-hidden="true" />} open>
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
                    'rounded-xl bg-[var(--ob-sheet)] p-3 text-left outline-none ring-1 ring-[var(--ob-line)] transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)] active:scale-[0.99] motion-reduce:transform-none',
                    store.fontFamily === font.family && 'bg-[var(--ob-brand-soft)] text-[var(--ob-ink)] ring-[var(--ob-brand)]/40',
                  )}
                >
                  <strong className="block text-sm">{font.label}</strong><span className="text-xs text-[var(--ob-ink-soft)]">{font.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Buttons & cards" icon={<LayoutGridIcon className="size-4.5 text-[var(--ob-brand)]" aria-hidden="true" />}>
        <div className="grid gap-4 pt-1 pb-5 @min-[32rem]:grid-cols-2">
          <div>
            <FieldLabel>Button shape</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(['PILL', 'ROUNDED', 'SQUARE'] as StorefrontButtonShape[]).map((value) => (
                <button key={value} type="button" aria-pressed={store.buttonShape === value} onClick={() => updateStore({ buttonShape: value })} className={cn('rounded-lg bg-[var(--ob-sheet)] px-3 py-2 text-sm capitalize outline-none ring-1 ring-[var(--ob-line)] transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', store.buttonShape === value && 'bg-[var(--ob-brand-soft)] text-[var(--ob-brand)] ring-[var(--ob-brand)]/40')}>{value.toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Product cards</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(['BORDER', 'SHADOW', 'FLAT'] as StorefrontCardStyle[]).map((value) => (
                <button key={value} type="button" aria-pressed={store.cardStyle === value} onClick={() => updateStore({ cardStyle: value })} className={cn('rounded-lg bg-[var(--ob-sheet)] px-3 py-2 text-sm capitalize outline-none ring-1 ring-[var(--ob-line)] transition-colors focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]', store.cardStyle === value && 'bg-[var(--ob-brand-soft)] text-[var(--ob-brand)] ring-[var(--ob-brand)]/40')}>{value.toLowerCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Messages & badges" icon={<MessageSquareIcon className="size-4.5 text-[var(--ob-brand)]" aria-hidden="true" />}>
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
                  <input id={`hero-badge-${index}`} value={badge} maxLength={60} onChange={(event) => updateHeroBadge(index, event.target.value)} aria-label={`Hero badge ${index + 1}`} className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--ob-line)] bg-[var(--ob-sheet)] px-3 text-sm outline-none focus:border-[var(--ob-brand)] focus:ring-3 focus:ring-[var(--ob-brand-soft)]" />
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove hero badge ${index + 1}`} onClick={() => updateStore({ heroBadges: store.heroBadges.filter((_, badgeIndex) => badgeIndex !== index) })}><Trash2Icon /></Button>
                </div>
              )) : <p className="text-xs text-[var(--ob-ink-soft)]">No hero badges added.</p>}
            </div>
          </div>

          <div>
            <FieldLabel>Trust strip</FieldLabel>
            <div className="grid gap-2 @min-[32rem]:grid-cols-2">
              {store.trustStrip.map((badge) => (
                <label key={badge.id} className="flex items-start gap-3 rounded-lg bg-[var(--ob-sheet)] p-3 ring-1 ring-[var(--ob-line)] transition-colors hover:bg-[var(--ob-canvas)]">
                  <input type="checkbox" checked={badge.enabled} onChange={(event) => updateStore({ trustStrip: store.trustStrip.map((item) => item.id === badge.id ? { ...item, enabled: event.target.checked } : item) })} className="mt-1" />
                  <span><strong className="block text-sm">{badge.title}</strong><span className="text-xs text-[var(--ob-ink-soft)]">{badge.subtitle}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Logo & banner" icon={<ImageIcon className="size-4.5 text-[var(--ob-brand)]" aria-hidden="true" />}>
        <div className="grid gap-4 pt-1 pb-5 @min-[32rem]:grid-cols-2">
          {(['logo', 'banner'] as const).map((kind) => {
            const isLogo = kind === 'logo'
            const inputRef = isLogo ? logoInputRef : bannerInputRef
            const file = isLogo ? runtime.logoFile : runtime.bannerFile
            const url = isLogo ? runtime.logoUrl : runtime.bannerUrl
            const error = isLogo ? logoError : bannerError
            return (
              <div key={kind} className="rounded-xl bg-[var(--ob-sheet)] p-4 ring-1 ring-[var(--ob-line)]">
                <div className="mb-3 flex items-center gap-2"><ImageIcon className="size-4 text-primary" /><strong className="text-sm">{isLogo ? 'Logo' : 'Banner'}</strong></div>
                <input ref={inputRef} id={`store-${kind}-file`} type="file" aria-label={`Choose ${kind} image`} accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onClick={(event) => { event.currentTarget.value = '' }} onChange={(event) => handleImage(kind, event)} />
                <Button type="button" variant="outline" size="sm" aria-label={`Choose ${kind} image`} onClick={() => inputRef.current?.click()}><UploadIcon /> Choose image</Button>
                <p className="mt-2 text-xs text-[var(--ob-ink-soft)]">PNG, JPEG, or WebP · {isLogo ? '500 KB' : '1 MB'} max</p>
                {file ? <p className="mt-2 truncate text-xs font-medium">{file.name}</p> : null}
                {url ? <Button type="button" className="mt-2" variant="ghost" size="sm" onClick={() => setImage(kind, null, null)}>Remove</Button> : null}
                {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
              </div>
            )
          })}
          <p className="text-xs leading-5 text-[var(--ob-ink-soft)] @min-[32rem]:col-span-2">Images stay in this tab, are never uploaded by the prototype, and must be chosen again after reload.</p>
        </div>
      </Disclosure>
    </div>
  )
}


/** Public store URL. Only meaningful once the backend has approved the vendor. */
function storeUrl(storeIdentifier: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/stores/${storeIdentifier}`
}

function ShareStore({ submission }: { submission: StoreSubmission }) {
  const [copied, setCopied] = useState(false)
  const approved = submission.approvalStatus?.toUpperCase() === 'APPROVED'
  const identifier = submission.storeIdentifier
  const url = identifier ? storeUrl(identifier) : null
  const shareable = approved && Boolean(url)

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-[var(--ob-canvas)] p-4">
      <h3 className="font-display text-sm font-semibold">Share your store</h3>
      {!shareable ? (
        <p className="text-sm leading-6 text-[var(--ob-ink-soft)]">
          Sharing unlocks once MithraDirect approves your store. Until then the link would not open
          for anyone you sent it to.
        </p>
      ) : (
        <p className="break-all rounded-lg bg-background p-2 text-sm">{url}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!shareable} onClick={() => void copy()}>
          <CopyIcon /> {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="outline" disabled={!shareable} asChild={shareable}>
          {shareable && url ? (
            <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
              <MessageSquareIcon /> WhatsApp
            </a>
          ) : (
            <span><MessageSquareIcon /> WhatsApp</span>
          )}
        </Button>
        <Button size="sm" variant="outline" disabled title="QR sharing is not built yet">
          <QrCodeIcon /> QR code
        </Button>
      </div>
    </div>
  )
}

function SubmissionStatus({ submission }: { submission: StoreSubmission }) {
  const approved = submission.approvalStatus?.toUpperCase() === 'APPROVED'
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[var(--ob-brand-soft)] p-5 text-foreground">
        {approved ? (
          <CheckCircle2Icon className="size-7 text-primary" />
        ) : (
          <ClockIcon className="size-7 text-primary" />
        )}
        <h3 className="mt-3 font-display text-xl font-semibold">
          {approved ? 'Your store is live' : 'Submitted — waiting for approval'}
        </h3>
        <p className="mt-2 text-sm leading-6">
          {approved
            ? 'Your storefront is public and customers can order from it.'
            : 'Everything you set up has been saved to your store. MithraDirect reviews new stores before they go public, so it is not reachable by customers yet.'}
        </p>
      </div>
      <ShareStore submission={submission} />
    </div>
  )
}

export function ReviewStep({ onGoToStep }: { onGoToStep: (step: OnboardingStep) => void }) {
  const draft = useOnboardingStore((state) => state.draft)
  const runtime = useOnboardingStore((state) => state.runtime)
  const storeSubmission = useOnboardingStore((state) => state.storeSubmission)
  const categoryLimit = useOnboardingStore(selectCategoryLimit)
  const productLimit = useOnboardingStore(selectProductLimit)
  const skuLimit = useOnboardingStore(selectSkuLimit)
  const accountCatalog = useOnboardingStore((state) => state.accountCatalog)
  const measurementCatalog = useOnboardingStore((state) => state.measurementCatalog)
  const issues = readinessIssues(draft, runtime, categoryLimit, measurementCatalog, {
    maxProducts: productLimit,
    maxSkus: skuLimit,
    account: accountCatalog,
  })
  const completed =
    draft.publication.state === 'prototype-complete' &&
    draft.completedSteps.includes(10) &&
    Boolean(draft.publication.draftSlug)

  if (storeSubmission) return <SubmissionStatus submission={storeSubmission} />

  if (!completed) {
    return (
      <div className="space-y-5">
        <div className={cn('rounded-xl p-4', issues.length ? 'bg-amber-50/80 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100' : 'bg-[var(--ob-brand-soft)] text-foreground')}>
          <h3 className="font-display font-semibold">{issues.length ? `${issues.length} readiness item${issues.length === 1 ? '' : 's'} to resolve` : 'Ready to submit your store'}</h3>
          <p className="mt-1 text-sm leading-6">{issues.length ? 'Each item links back to the step where it can be fixed.' : 'Submitting saves everything to your store and sends it for approval.'}</p>
        </div>
        {issues.length ? (
          <ul className="space-y-2" aria-label="Readiness issues">
            {issues.map((item, index) => (
              <li key={`${item.step}-${item.field}-${index}`}>
                <button type="button" onClick={() => onGoToStep(item.step)} className="flex w-full items-start justify-between gap-3 rounded-lg bg-[var(--ob-canvas)] p-3 text-left text-sm outline-none transition-colors hover:bg-[var(--ob-canvas)] focus-visible:ring-3 focus-visible:ring-[var(--ob-brand-soft)]">
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
            ].map(([label, value]) => <div key={label} className="rounded-lg bg-[var(--ob-canvas)] p-3"><span className="block text-xs text-[var(--ob-ink-soft)]">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-[var(--ob-brand-soft)] p-5 text-foreground">
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
