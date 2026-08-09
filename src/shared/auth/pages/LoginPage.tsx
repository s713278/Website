import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { homePathForRole } from '@/app/router/role-home'
import { getErrorMessage } from '@/shared/api'
import { DEMO_CREDENTIALS } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, Input } from '@/shared/components'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('customer@demo.com')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homePathForRole(user.role)} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      const nextUser = useAuthStore.getState().user
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? (nextUser ? homePathForRole(nextUser.role) : '/'), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <Card className="space-y-6 p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--md-green-700)]">
            MithraDirect
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--md-muted)]">Sign in to order or manage your store.</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" name="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}
          <Button type="submit" fullWidth disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-2 font-semibold">Demo accounts</p>
          <ul className="space-y-1">
            {DEMO_CREDENTIALS.map((cred) => (
              <li key={cred.email}>
                <button type="button" className="text-left hover:text-[var(--md-green-700)]" onClick={() => { setEmail(cred.email); setPassword(cred.password) }}>
                  {cred.role}: {cred.email}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-center text-sm text-[var(--md-muted)]">
          New here? <Link className="font-semibold text-[var(--md-green-700)]" to="/register">Create an account</Link>
        </p>
      </Card>
    </div>
  )
}
