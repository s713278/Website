import { Link } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, LogOut, User } from 'lucide-react'
import { homePathForRole } from '@/app/router/role-home'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/shared/auth/store/auth-store'
import { accountLabel } from '@/shared/lib/account-label'

/**
 * The signed-in account's avatar menu, shared by every header. Renders nothing signed out;
 * each header keeps its own Sign in link for that. `onSignOut` lets a header close its own
 * mobile menu, which would otherwise stay open showing the signed-out actions.
 */
export function AccountMenu({
  ordersHref = '/orders',
  onSignOut,
}: {
  ordersHref?: string
  onSignOut?: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  if (!user) return null

  const label = accountLabel(user)
  const vendor = user.role === 'vendor'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--store-theme,var(--md-green-600))]/40"
        aria-label="Account"
        title="Account"
      >
        <User className="size-[1.125rem]" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {label ? (
          <>
            <DropdownMenuLabel className="px-2 py-1.5">
              <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          {vendor ? (
            <Link to={homePathForRole('vendor')}>
              <LayoutDashboard />
              Dashboard
            </Link>
          ) : (
            <Link to={ordersHref}>
              <ClipboardList />
              My orders
            </Link>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            onSignOut?.()
            void logout()
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
