import { Link } from 'react-router-dom'
import { Button } from '@/shared/components'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--md-green-700)]">404</p>
      <h1 className="font-display mt-2 text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-[var(--md-muted)]">That route doesn’t exist in MithraDirect.</p>
      <Link to="/" className="mt-6"><Button>Go home</Button></Link>
    </div>
  )
}
