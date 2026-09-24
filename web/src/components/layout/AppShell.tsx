import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileTopBar } from './MobileTopBar'
import { MobileTabBar } from './MobileTabBar'

export function AppShell() {
  return (
    <div className="flex h-dvh min-h-[100svh] overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-20 md:px-7 md:py-8 md:pb-8">
          <div className="mx-auto max-w-[1200px]">
            <Outlet />
          </div>
        </main>
        <MobileTabBar />
      </div>
    </div>
  )
}
