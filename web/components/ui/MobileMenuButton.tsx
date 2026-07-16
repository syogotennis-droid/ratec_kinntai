'use client'

import { useSidebar } from '@/lib/sidebar-context'

export default function MobileMenuButton() {
  const openSidebar = useSidebar()
  return (
    <button onClick={openSidebar} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg shrink-0 md:hidden">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  )
}
