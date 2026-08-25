import { Outlet } from 'react-router-dom'
export function StorefrontLayout() {
  return (
    <div data-store-mode="light" className="store-shell flex min-h-screen flex-col">
      <Outlet />
    </div>
  )
}
