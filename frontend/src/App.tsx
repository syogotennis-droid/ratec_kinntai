import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import CalendarPage from './pages/CalendarPage'
import WorkListPage from './pages/WorkListPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminWorkListPage from './pages/AdminWorkListPage'
import PayrollPage from './pages/PayrollPage'
import SettingsPage from './pages/SettingsPage'
import EmployeesPage from './pages/EmployeesPage'
import Layout from './components/Layout'

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen">読み込み中...</div>
  if (!user) return <Navigate to="/login" />
  if (adminOnly && !user.is_admin) return <Navigate to="/" />
  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={user?.is_admin ? <Navigate to="/admin" /> : <Navigate to="/calendar" />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="my-records" element={<WorkListPage />} />
        <Route path="admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="admin/work-list" element={<ProtectedRoute adminOnly><AdminWorkListPage /></ProtectedRoute>} />
        <Route path="admin/payroll" element={<ProtectedRoute adminOnly><PayrollPage /></ProtectedRoute>} />
        <Route path="admin/employees" element={<ProtectedRoute adminOnly><EmployeesPage /></ProtectedRoute>} />
        <Route path="admin/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
