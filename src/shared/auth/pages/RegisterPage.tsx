import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { homePathForRole } from '@/app/router/role-home'
import { getErrorMessage } from '@/shared/api'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { Button, Card, Input, Label } from '@/shared/components'
import type { UserRole } from '@/shared/types'

export function RegisterPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const register = useAuthStore((s) => s.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('customer')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={homePathForRole(user.role)} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ name, email, password, role })
      const nextUser = useAuthStore.getState().user
      navigate(nextUser ? homePathForRole(nextUser.role) : '/', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'))
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
          <h1 className="font-display mt-1 text-2xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-[var(--md-muted)]">Join as a customer or open a vendor kitchen.</p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input label="Full name" name="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" name="password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="grid gap-1.5">
            <Label htmlFor="role">I am a</Label>
            <select
              id="role"
              className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          {error ? <p className="text-sm text-[var(--md-danger)]">{error}</p> : null}
          <Button type="submit" fullWidth disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
        </form>
        <p className="text-center text-sm text-[var(--md-muted)]">
          Already have an account? <Link className="font-semibold text-[var(--md-green-700)]" to="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  )
}
