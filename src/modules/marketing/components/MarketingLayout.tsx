import { Outlet } from 'react-router-dom'
import { MarketingHeader } from '@/modules/marketing/components/MarketingHeader'

export function MarketingLayout() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
