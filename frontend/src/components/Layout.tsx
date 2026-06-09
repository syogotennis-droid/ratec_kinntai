import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'

const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const employeeNavItems = [
    { to: '/calendar', label: 'カレンダー', icon: '📅' },
    { to: '/my-records', label: '勤務一覧', icon: '📋' },
    { to: '/sales', label: '売上管理', icon: '💰' },
  ]

  const adminNavItems = [
    { to: '/admin', label: 'ダッシュボード', icon: '🏠' },
    { to: '/admin/work-list', label: '勤務管理', icon: '📝' },
    { to: '/admin/payroll', label: '給与計算', icon: '💴' },
    { to: '/admin/employees', label: '従業員管理', icon: '👥' },
    { to: '/admin/sales', label: '売上管理', icon: '💰' },
    { to: '/admin/bonuses', label: 'ボーナス管理', icon: '🎁' },
    { to: '/admin/settings', label: '設定', icon: '⚙️' },
  ]

  const navItems = user?.is_admin ? adminNavItems : employeeNavItems

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            勤
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">勤怠管理</h1>
            <p className="text-xs text-gray-500">システム</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass} end={item.to === '/admin'}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.employee_id}</p>
            </div>
            {user?.is_admin && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                管理者
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <span>🚪</span>
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              勤
            </div>
            <h1 className="text-base font-bold text-gray-900">勤怠管理</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-5 h-5 flex flex-col justify-center gap-1">
                <span className={`block h-0.5 bg-gray-600 transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 bg-gray-600 transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 bg-gray-600 transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="bg-white border-t border-gray-100 shadow-lg">
            <nav className="px-3 py-2 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  end={item.to === '/admin'}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="px-3 py-2 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <span>🚪</span>
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-16">
        <div className="h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
