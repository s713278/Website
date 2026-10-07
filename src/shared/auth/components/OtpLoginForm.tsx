import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleCheck, MessageCircle } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginPathForRole } from '@/app/router/role-home'
import { resolveLandingPath } from '@/app/router/vendor-landing'
import logoDarkMd from '@/assets/logo_dark_md.png'
import { StoreBrandLogo } from '@/modules/storefront/components/StoreBrandLogo'
import {
  authService,
  getErrorMessage,
  isValidMobile,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button } from '@/shared/components'
import type { UserRole } from '@/shared/types'

type Step = 'phone' | 'otp'

type OtpLoginFormProps = {
  role: UserRole
  shopName?: string
  shopLogoUrl?: string
  from?: string
}

export function OtpLoginForm({
  role,
  shopName,
  shopLogoUrl,
  from: fromProp,
}: OtpLoginFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const completeOtpLogin = useAuthStore((s) => s.completeOtpLogin)
  const from =
    fromProp || (location.state as { from?: string } | null)?.from
  const isVendor = role === 'vendor'
  const shop = !isVendor && shopName ? { name: shopName, logoUrl: shopLogoUrl } : null

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const requestGen = useRef(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  useEffect(() => {
    return () => {
      requestGen.current += 1
    }
  }, [])

  async function sendOtp() {
    setError('')
    if (!isValidMobile(phone)) {
      setError('Enter a valid 10-digit WhatsApp number.')
      return
    }

    const gen = ++requestGen.current
    setSending(true)
    try {
      await authService.requestOtp({ phone, role })
      if (gen !== requestGen.current) return
      setStep('otp')
      setOtp('')
      setCooldown(OTP_RESEND_SECONDS)
    } catch (err) {
      if (gen !== requestGen.current) return
      setError(getErrorMessage(err, 'Could not send OTP. Try again.'))
    } finally {
      if (gen === requestGen.current) setSending(false)
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault()
    setError('')
    const code = otp.replace(/\D/g, '')
    if (code.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit OTP.`)
      return
    }

    const gen = ++requestGen.current
    setVerifying(true)
    try {
      const session = await authService.verifyOtp({ phone, otp: code, role })
      if (gen !== requestGen.current) return
      completeOtpLogin(session)
      // Resolved before navigating: a vendor whose store is already submitted goes
      // straight to their dashboard instead of flashing through the setup wizard.
      const destination = await resolveLandingPath(session.user, from)
      if (gen !== requestGen.current) return
      navigate(destination, { replace: true })
    } catch (err) {
      if (gen !== requestGen.current) return
      setError(getErrorMessage(err, 'Invalid or expired OTP. Try again.'))
    } finally {
      if (gen === requestGen.current) setVerifying(false)
    }
  }

  const heading =
    step === 'otp'
      ? 'Enter the OTP'
      : isVendor
        ? 'Sign in to your shop'
        : shop
          ? `Sign in to order from ${shop.name}`
          : 'Sign in to MithraDirect'
  const lead = isVendor
    ? 'New to MithraDirect? The same number sets up your shop.'
    : shop
      ? `${shop.name} uses your WhatsApp number to reach you about your order.`
      : 'Shops use your WhatsApp number to reach you about your orders.'
  const errorId = error ? 'login-error' : undefined
  const phoneComplete = isValidMobile(phone)
  // Only the cell the next digit lands in is highlighted, so the row reads like a cursor.
  const activeCell = Math.min(otp.length, OTP_LENGTH - 1)
  const linkClass =
    'rounded font-semibold text-[var(--md-green-700)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--md-green-600)]'

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col">
        {/* Phones get the awning instead of the street, which has no room beside the form. */}
        <div className="md-awning mb-1 lg:hidden" aria-hidden />
        <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
          {shop ? (
            <Link to={from || '/stores'} aria-label={shop.name}>
              <StoreBrandLogo storeName={shop.name} logoUrl={shop.logoUrl} />
            </Link>
          ) : (
            <Link to="/" aria-label="Mithra Direct home">
              <img
                src={logoDarkMd}
                alt="Mithra Direct — Shop Local, Support Local, Grow Together"
                className="h-9 w-auto"
              />
            </Link>
          )}
          <Link
            to={shop ? from || '/stores' : '/'}
            className="inline-flex min-h-11 items-center rounded text-sm font-medium text-[var(--md-muted)] hover:text-[var(--md-green-700)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--md-green-600)]"
          >
            {shop ? 'Back to shop' : 'Back to home'}
          </Link>
        </header>

        <main className="flex flex-1 flex-col px-6 pb-12 pt-12 sm:px-10 sm:pt-16 lg:justify-center lg:pb-24 lg:pt-6">
          <div
            key={step}
            className="mx-auto w-full max-w-[24rem] animate-in fade-in-0 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
          >
            <h1 className="text-balance text-center font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--md-ink)] sm:text-3xl">
              {heading}
            </h1>

            {step === 'phone' ? (
              <>
                <p className="mt-2 text-balance text-center text-[0.9375rem] leading-relaxed text-[var(--md-muted)]">{lead}</p>
                <form
                  className="mt-8"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault()
                    void sendOtp()
                  }}
                >
                  <div
                    className={
                      'flex h-16 items-center rounded-2xl border bg-white transition-colors focus-within:ring-4 motion-reduce:transition-none ' +
                      (error
                        ? 'border-[var(--md-danger)] focus-within:ring-[var(--md-danger)]/15'
                        : 'border-slate-300 focus-within:border-[var(--md-green-600)] focus-within:ring-[var(--md-green-600)]/15')
                    }
                  >
                    <MessageCircle className="mx-4 size-5 shrink-0 text-slate-500" aria-hidden />
                    <span className="h-8 w-px shrink-0 bg-slate-200" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
                      <label className="text-xs text-[var(--md-muted)]" htmlFor="phone">
                        WhatsApp number
                      </label>
                      <div className="flex items-baseline gap-1.5 text-base font-medium tabular-nums">
                        <span className="text-slate-500">+91</span>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          autoFocus
                          maxLength={10}
                          required
                          aria-invalid={error ? true : undefined}
                          aria-describedby={['phone-help', errorId].filter(Boolean).join(' ')}
                          placeholder="10-digit number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="min-w-0 flex-1 bg-transparent text-[var(--md-ink)] caret-[var(--md-green-700)] outline-none placeholder:font-normal placeholder:normal-nums placeholder:text-[var(--md-muted)]"
                        />
                      </div>
                    </div>
                    {phoneComplete ? (
                      <CircleCheck className="mr-4 size-5 shrink-0 fill-[var(--md-green-600)] text-white" aria-hidden />
                    ) : null}
                  </div>
                  {error ? (
                    <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--md-danger)]">
                      {error}
                    </p>
                  ) : null}
                  <p id="phone-help" className="mt-2 text-sm text-[var(--md-muted)]">
                    We’ll send a {OTP_LENGTH}-digit OTP to this number on WhatsApp.
                  </p>
                  <Button type="submit" size="lg" fullWidth className="mt-6 h-12 rounded-xl" disabled={sending}>
                    {sending ? 'Sending OTP…' : 'Send OTP'}
                  </Button>
                </form>

                {/* Phone step only: leaving mid-OTP would abandon a code that was already sent. */}
                {isVendor || !shop ? (
                  <p className="mt-8 text-center text-sm text-[var(--md-muted)]">
                    {isVendor ? 'Shopping, not selling?' : 'Selling on MithraDirect?'}{' '}
                    <Link to={loginPathForRole(isVendor ? 'customer' : 'vendor')} className={linkClass}>
                      {isVendor ? 'Sign in as a customer' : 'Sign in to your shop'}
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p id="otp-sent-to" className="mt-2 text-balance text-center text-[0.9375rem] leading-relaxed text-[var(--md-muted)]">
                  Sent on WhatsApp to{' '}
                  <span className="whitespace-nowrap font-medium tabular-nums text-[var(--md-ink)]">
                    +91 {phone.slice(0, 5)} {phone.slice(5)}
                  </span>
                  .{' '}
                  <button
                    type="button"
                    className={`${linkClass} inline-flex min-h-11 items-center disabled:text-[var(--md-muted)]`}
                    disabled={sending || verifying}
                    onClick={() => {
                      setStep('phone')
                      setOtp('')
                      setError('')
                      setCooldown(0)
                    }}
                  >
                    Change number
                  </button>
                </p>
                <form className="mt-8" noValidate onSubmit={onVerify}>
                  <div className="group relative">
                    <input
                      id="otp"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={OTP_LENGTH}
                      required
                      aria-label={`${OTP_LENGTH}-digit OTP`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={['otp-sent-to', errorId].filter(Boolean).join(' ')}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                      // The real input spans the cells but draws nothing, so typing, paste and
                      // WhatsApp/SMS autofill all go through one field.
                      className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
                    />
                    <div className="grid grid-cols-4 gap-3" aria-hidden>
                      {Array.from({ length: OTP_LENGTH }, (_, i) => (
                        <span
                          key={i}
                          className={
                            'flex h-16 items-center justify-center rounded-2xl border bg-white font-display text-3xl font-semibold tabular-nums text-[var(--md-ink)] transition-colors motion-reduce:transition-none ' +
                            (error
                              ? 'border-[var(--md-danger)]'
                              : i === activeCell
                                ? 'border-slate-300 group-focus-within:border-[var(--md-green-600)] group-focus-within:ring-4 group-focus-within:ring-[var(--md-green-600)]/15'
                                : otp[i]
                                  ? 'border-slate-400'
                                  : 'border-slate-300')
                          }
                        >
                          {otp[i] ?? ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  {error ? (
                    <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--md-danger)]">
                      {error}
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" fullWidth className="mt-6 h-12 rounded-xl" disabled={verifying}>
                    {verifying ? 'Verifying…' : 'Verify & continue'}
                  </Button>
                  <p className="mt-5 text-center text-sm text-[var(--md-muted)]">
                    Didn’t get it?{' '}
                    <button
                      type="button"
                      className={`${linkClass} inline-flex min-h-11 items-center disabled:font-medium disabled:text-[var(--md-muted)] disabled:no-underline`}
                      disabled={cooldown > 0 || sending || verifying}
                      onClick={() => void sendOtp()}
                    >
                      {cooldown > 0 ? `Resend OTP in ${cooldown}s` : sending ? 'Sending OTP…' : 'Resend OTP'}
                    </button>
                  </p>
                </form>
              </>
            )}
          </div>
        </main>
      </div>

      <aside className="sticky top-0 hidden h-dvh p-3 lg:block" aria-hidden>
        <div className="flex h-full flex-col overflow-hidden rounded-[2rem] bg-[#ecfdf5]">
          <div className="flex-none px-8 pb-10 pt-10 xl:px-12 xl:pt-14">
            <p className="max-w-md text-balance font-display text-[1.75rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--md-green-800)] xl:text-[2rem]">
              {isVendor ? 'Your shop, open to the whole neighbourhood.' : 'Order from the shops around you.'}
            </p>
            <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-[var(--md-green-700)]">
              {isVendor
                ? 'Florists, bakers and grocers take orders from nearby customers on WhatsApp.'
                : 'Florists, bakers and grocers nearby, all in one place.'}
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-end">
            <div className="relative">
              <div className="absolute -top-7 left-8 z-10 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgb(6_78_59/0.12)] xl:left-12">
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--md-green-700)] text-white">
                  <MessageCircle className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--md-ink)]">{isVendor ? 'New order' : 'Order placed'}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-[var(--md-muted)]">{isVendor ? 'Priya · ₹246' : 'Fresh bakes · ₹246'}</p>
                </div>
              </div>
              <img
                src="/images/auth/neighbourhood-market-reference.png"
                alt=""
                width={1536}
                height={1024}
                fetchPriority="high"
                className="block aspect-[3/2] max-h-[65dvh] w-full object-cover object-center"
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
