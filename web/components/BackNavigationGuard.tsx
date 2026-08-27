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

// タブレット端末(Android)によっては、popstate発火からJS側の積み直しが
// 間に合う前に連続して「戻る」が処理され、1〜2回消費しただけでアプリが
// 終了してしまうことがある。そのため1回のガードにつき複数枚を重ねて積み、
// 多少タイミングがずれても余裕を持って耐えられるようにする。
const GUARD_DEPTH = 5

function armGuard() {
  const path = window.location.pathname
  if (path !== getSectionRoot(path)) return
  for (let i = 0; i < GUARD_DEPTH; i++) {
    window.history.pushState({ __backGuard: true }, '', path)
  }
}

export default function BackNavigationGuard() {
  const pathname = usePathname()

  useEffect(() => {
    armGuard()
  }, [pathname])

  useEffect(() => {
    // popstate: 「戻る」操作そのもの
    // pageshow/visibilitychange: 端末のタスク切り替え・バックグラウンド復帰時に
    // 積んだ分が失われている場合に備えて、画面が表に戻るたびにも積み直す
    const onVisible = () => {
      if (document.visibilityState === 'visible') armGuard()
    }
    window.addEventListener('popstate', armGuard)
    window.addEventListener('pageshow', armGuard)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('popstate', armGuard)
      window.removeEventListener('pageshow', armGuard)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}
