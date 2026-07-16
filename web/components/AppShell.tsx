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
      { to: '/attendance/admin/payroll', label: '残業時間集計' },
      { to: '/attendance/admin/bonuses', label: '給与・賞与管理' },
      { to: '/attendance/admin/card-expenses', label: 'カード経費' },
      { to: '/attendance/admin/employees', label: '従業員管理' },
    ],
  },
  {
    heading: '書類',
    items: [
      { to: '/orders/projects', label: '案件管理' },
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
      { to: '/orders/projects', label: '案件管理' },
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
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
      {navGroups.map((group) => (
        <div key={group.heading ?? group.items[0]?.to}>
          {group.heading && <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{group.heading}</p>}
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
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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

  const avatarLabel = profile.avatar_char || profile.name.slice(0, 1)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: profile.color || '#2563eb' }}
        >
          {avatarLabel}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
          <p className="text-xs text-slate-400">{profile.is_admin ? '管理者' : '担当者'}</p>
        </div>
      </div>
      <NavLinks />
      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
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
      <aside className="hidden md:flex md:w-60 md:flex-col md:flex-shrink-0 bg-slate-900">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-64 h-full bg-slate-900 flex flex-col">
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
