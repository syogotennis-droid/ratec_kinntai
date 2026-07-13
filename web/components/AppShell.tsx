'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/supabase/types'

const adminNavItems = [
  { to: '/attendance/admin/work-list', label: '勤務管理', icon: '📝' },
  { to: '/attendance/admin/sales', label: '売上管理', icon: '💰' },
  { to: '/attendance/admin/bonuses', label: 'ボーナス管理', icon: '🎁' },
  { to: '/attendance/admin/payroll', label: '給与計算', icon: '💴' },
  { to: '/attendance/admin/employees', label: '従業員管理', icon: '👥' },
]

const employeeNavItems = [
  { to: '/attendance/calendar', label: 'カレンダー', icon: '📅' },
  { to: '/attendance/my-records', label: '勤務一覧', icon: '📋' },
  { to: '/attendance/sales', label: '売上管理', icon: '💰' },
  { to: '/orders/companies', label: '会社管理', icon: '🏢' },
  { to: '/orders/projects', label: '案件管理', icon: '📁' },
  { to: '/orders/quotations', label: '見積書', icon: '📋' },
  { to: '/orders/invoices', label: '請求書', icon: '📄' },
  { to: '/orders/purchase-orders', label: '発注書', icon: '🛒' },
  { to: '/orders/suppliers', label: '仕入先', icon: '🏭' },
  { to: '/orders/products', label: '商品マスター', icon: '📦' },
  { to: '/orders/settings', label: '自社設定', icon: '⚙️' },
]

interface Props {
  profile: Profile
  children: React.ReactNode
}

export default function AppShell({ profile, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navItems = profile.is_admin ? adminNavItems : employeeNavItems

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavLinks = () => (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      {navItems.map((item) => {
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
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-gray-200">
        <h1 className="text-sm font-bold text-gray-900">業務管理システム</h1>
        <p className="text-xs text-gray-500 mt-0.5">{profile.name}</p>
      </div>
      <NavLinks />
      <div className="px-3 py-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>🚪</span>
          ログアウト
        </button>
      </div>
    </div>
  )

  return (
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
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-sm font-bold text-gray-900">業務管理システム</h1>
          <span className="text-xs text-gray-500">{profile.name}</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
