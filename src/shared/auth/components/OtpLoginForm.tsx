import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { resolveLandingPath } from '@/app/router/vendor-landing'
import {
  authService,
  AuthSessionError,
  getErrorMessage,
  isValidMobile,
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
} from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Input } from '@/shared/components'
import type { UserRole } from '@/shared/types'

type Step = 'phone' | 'otp'

type OtpLoginFormProps = {
  role: UserRole
}

export function OtpLoginForm({ role }: OtpLoginFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const completeOtpLogin = useAuthStore((s) => s.completeOtpLogin)
  const from = (location.state as { from?: string } | null)?.from

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const requestGen = useRef(0)

  const isVendor = role === 'vendor'

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
      setError('Enter a valid 10-digit mobile number.')
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
      // The number verified but the app refused the session, and `verifyOtp` already
      // dropped the tokens. Clear any existing app session too, so the header cannot keep
      // showing a signed-in user with no credentials behind them.
      if (err instanceof AuthSessionError) useAuthStore.getState().clearSession()
      setError(getErrorMessage(err, 'Invalid or expired OTP. Try again.'))
    } finally {
      if (gen === requestGen.current) setVerifying(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.16), transparent 55%), radial-gradient(ellipse 40% 30% at 100% 100%, rgba(209,250,229,0.5), transparent)',
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-md items-center justify-between px-4 py-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
            M
          </span>
          <span className="font-display text-base font-bold text-slate-800">
            mithra <span className="font-semibold text-slate-600">direct</span>
          </span>
        </Link>
        <Link to="/" className="text-sm font-medium text-slate-500 hover:text-emerald-700">
          Back to home
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col px-4 pb-16 pt-4">
        <div className="rounded-2xl border border-[var(--md-border)] bg-white p-6 shadow-[var(--md-shadow)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--md-green-700)]">
            {isVendor ? 'Vendor login' : 'Customer login'}
          </p>
          <h1 className="font-display mt-2 text-2xl font-bold text-slate-900">Sign in with OTP</h1>
          <p className="mt-1 text-sm text-[var(--md-muted)]">
            {isVendor
              ? 'Verify your mobile to continue store setup.'
              : 'Verify your mobile to continue to your cart.'}
          </p>

          {step === 'phone' ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void sendOtp()
              }}
            >
              <div className="grid gap-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                  Mobile number
                </label>
                <div className="flex overflow-hidden rounded-lg border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="flex items-center border-r border-input bg-slate-50 px-3 text-sm font-medium text-slate-600">
                    +91
                  </span>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    required
                    placeholder="10-digit mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="h-11 flex-1 bg-transparent px-3 text-sm outline-none"
                  />
                </div>
              </div>
              {error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}
              <p className="text-xs text-[var(--md-muted)]">We’ll send a 4-digit code to this number.</p>
              <Button type="submit" fullWidth disabled={sending}>
                {sending ? 'Sending…' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onVerify}>
              <p className="text-sm text-[var(--md-muted)]">
                Enter the {OTP_LENGTH}-digit code sent to{' '}
                <span className="font-medium text-slate-800">+91 {phone}</span>
              </p>
              <Input
                label="OTP"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                required
                placeholder={`${OTP_LENGTH}-digit OTP`}
                value={otp}
                className="h-11 text-center text-lg tracking-[0.35em]"
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
              />
              {error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}
              <Button type="submit" fullWidth disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  className="font-semibold text-[var(--md-green-700)] disabled:text-[var(--md-muted)]"
                  disabled={cooldown > 0 || sending || verifying}
                  onClick={() => void sendOtp()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  className="text-[var(--md-muted)] hover:text-[var(--md-ink)]"
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
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--md-muted)]">
          {isVendor ? (
            <>
              Shopping instead?{' '}
              <Link className="font-semibold text-[var(--md-green-700)]" to="/login">
                Customer login
              </Link>
            </>
          ) : (
            <>
              Selling instead?{' '}
              <Link className="font-semibold text-[var(--md-green-700)]" to="/vendor/login">
                Vendor login
              </Link>
            </>
          )}
        </p>
      </main>
    </div>
  )
}
