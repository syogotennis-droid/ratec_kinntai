'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// サイドバーの各メニューは、その画面グループの入り口(ルート)。
// 「戻る」を押した時にこの画面より奥へは戻れないようにし、アプリが
// 終了してしまう(履歴が尽きる)のも防ぐ。
const SECTION_ROOTS = [
  '/schedule',
  '/attendance/sales',
  '/attendance/admin/sales',
  '/attendance/admin/work-list',
  '/attendance/admin/payroll',
  '/attendance/admin/bonuses',
  '/attendance/admin/card-expenses',
  '/attendance/admin/employees',
  '/orders/projects',
  '/orders/quotations',
  '/orders/invoices',
  '/orders/purchase-orders',
  '/orders/companies',
  '/orders/suppliers',
]

function getSectionRoot(pathname: string): string {
  const matches = SECTION_ROOTS.filter(root => pathname === root || pathname.startsWith(`${root}/`))
  if (matches.length === 0) return pathname
  return matches.sort((a, b) => b.length - a.length)[0]
}

// 今いる画面がセクションのルートなら、同じURLの履歴を積み直す。
// 「戻る」で1つ消費されてもまたルートに留まり続け、それより奥(前のセクション
// やアプリの外)へは進まない。何度戻るを押しても効果が続くよう毎回積み直す。
function guardIfAtRoot() {
  const path = window.location.pathname
  if (path === getSectionRoot(path)) {
    window.history.pushState({ __backGuard: true }, '', path)
  }
}

export default function BackNavigationGuard() {
  const pathname = usePathname()

  useEffect(() => {
    guardIfAtRoot()
  }, [pathname])

  useEffect(() => {
    window.addEventListener('popstate', guardIfAtRoot)
    return () => window.removeEventListener('popstate', guardIfAtRoot)
  }, [])

  return null
}
