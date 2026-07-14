'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/supabase/types'
import { ProfileContext } from '@/lib/profile-context'
import { SidebarContext } from '@/lib/sidebar-context'

interface NavItem {
  to: string
  label: string
}

interface NavGroup {
  heading?: string
  items: NavItem[]
}

const adminNavGroups: NavGroup[] = [
  {
    items: [
      { to: '/schedule', label: '予定' },
      { to: '/attendance/admin/sales', label: '売上管理' },
    ],
  },
  {
    heading: '人事労務',
    items: [
      { to: '/attendance/admin/work-list', label: '勤怠管理' },
      { to: '/attendance/admin/payroll', label: '給与計算' },
      { to: '/attendance/admin/bonuses', label: 'ボーナス管理' },
      { to: '/attendance/admin/employees', label: '従業員管理' },
    ],
  },
  {
    heading: '書類',
    items: [
      { to: '/orders/projects', label: '工事管理' },
      { to: '/orders/quotations', label: '見積書' },
      { to: '/orders/invoices', label: '請求書/納品書' },
      { to: '/orders/purchase-orders', label: '注文書' },
      { to: '/orders/companies', label: '取引先管理' },
      { to: '/orders/suppliers', label: '仕入先管理' },
    ],
  },
]

const employeeNavGroups: NavGroup[] = [
  {
    items: [
      { to: '/schedule', label: '勤怠/予定' },
      { to: '/attendance/sales', label: '売上管理' },
    ],
  },
  {
    heading: '書類',
    items: [
      { to: '/orders/projects', label: '工事管理' },
      { to: '/orders/quotations', label: '見積書' },
      { to: '/orders/invoices', label: '請求書/納品書' },
      { to: '/orders/purchase-orders', label: '注文書' },
      { to: '/orders/companies', label: '取引先管理' },
      { to: '/orders/suppliers', label: '仕入先管理' },
    ],
  },
]

interface Props {
  profile: Profile
  children: React.ReactNode
}

export default function AppShell({ profile, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navGroups = profile.is_admin ? adminNavGroups : employeeNavGroups

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavLinks = () => (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
      {navGroups.map((group) => (
        <div key={group.heading ?? group.items[0]?.to}>
          {group.heading && <p className="px-3 mb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{group.heading}</p>}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200">
        <p className="text-sm font-medium text-gray-900">{profile.name}</p>
      </div>
      <NavLinks />
      <div className="px-3 py-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          ログアウト
        </button>
      </div>
    </div>
  )

  return (
    <ProfileContext.Provider value={profile}>
    <SidebarContext.Provider value={() => setSidebarOpen(true)}>
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:flex-shrink-0 border-r border-gray-200 bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-64 h-full bg-white flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </SidebarContext.Provider>
    </ProfileContext.Provider>
  )
}
