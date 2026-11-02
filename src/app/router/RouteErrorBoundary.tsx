import { Component, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LoadError } from '@/shared/components/LoadError'

type BoundaryProps = { resetKey: string; children: ReactNode }
type BoundaryState = { failed: boolean }

class RouteErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[route]', error)
  }

  // Reset only a failed boundary, and only once the user leaves the failed path. Keying the
  // boundary on the pathname instead would remount every layout and refetch on each navigation.
  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-4">
        {/* Reload, not a state reset: React.lazy caches a rejected import, so only a reload retries the chunk. */}
        <LoadError className="justify-items-center" onRetry={() => window.location.reload()} />
      </div>
    )
  }
}

/** Gives a thrown route render or a failed lazy chunk a full-screen LoadError. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <RouteErrorBoundaryInner resetKey={pathname}>{children}</RouteErrorBoundaryInner>
}
