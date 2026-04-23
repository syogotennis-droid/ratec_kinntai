import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { usersApi } from '../services/api'
import { User } from '../types'

const employmentTypeLabels: Record<string, string> = {
  hourly: '時給',
  daily: '日給',
  monthly: '月給',
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

interface EmployeeFormData {
  employee_id: string
  name: string
  name_kana: string
  email: string
  department: string
  employment_type: 'hourly' | 'daily' | 'monthly'
  hourly_wage: number
  daily_wage: number
  transportation: number
  fixed_allowance: number
  overtime_rate: number
  late_night_rate: number
  holiday_rate: number
  is_admin: boolean
  password?: string
}

const defaultValues: EmployeeFormData = {
  employee_id: '',
  name: '',
  name_kana: '',
  email: '',
  department: '',
  employment_type: 'hourly',
  hourly_wage: 1000,
  daily_wage: 0,
  transportation: 0,
  fixed_allowance: 0,
  overtime_rate: 1.25,
  late_night_rate: 1.5,
  holiday_rate: 1.35,
  is_admin: false,
  password: '',
}

interface EmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  editUser?: User | null
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ isOpen, onClose, editUser }) => {
  const queryClient = useQueryClient()
  const isEdit = !!editUser

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormData>({
    defaultValues: editUser
      ? {
          employee_id: editUser.employee_id,
          name: editUser.name,
          name_kana: editUser.name_kana ?? '',
          email: editUser.email,
          department: editUser.department ?? '',
          employment_type: editUser.employment_type,
          hourly_wage: editUser.hourly_wage,
          daily_wage: editUser.daily_wage,
          transportation: editUser.transportation,
          fixed_allowance: editUser.fixed_allowance,
          overtime_rate: editUser.overtime_rate,
          late_night_rate: editUser.late_night_rate,
          holiday_rate: editUser.holiday_rate,
          is_admin: editUser.is_admin,
          password: '',
        }
      : defaultValues,
  })

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  React.useEffect(() => {
    if (isOpen) {
      if (editUser) {
        reset({
          employee_id: editUser.employee_id,
          name: editUser.name,
          name_kana: editUser.name_kana ?? '',
          email: editUser.email,
          department: editUser.department ?? '',
          employment_type: editUser.employment_type,
          hourly_wage: editUser.hourly_wage,
          daily_wage: editUser.daily_wage,
          transportation: editUser.transportation,
          fixed_allowance: editUser.fixed_allowance,
          overtime_rate: editUser.overtime_rate,
          late_night_rate: editUser.late_night_rate,
          holiday_rate: editUser.holiday_rate,
          is_admin: editUser.is_admin,
          password: '',
        })
      } else {
        reset(defaultValues)
      }
      setError(null)
    }
  }, [isOpen, editUser, reset])

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const onSubmit = async (data: EmployeeFormData) => {
    setError(null)
    setIsSaving(true)
    try {
      const payload: any = { ...data }
      if (isEdit && !payload.password) delete payload.password
      if (isEdit && editUser) {
        await updateMutation.mutateAsync({ id: editUser.id, data: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? '従業員を編集' : '従業員を追加'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Basic Info */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">基本情報</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">社員番号 *</label>
                  <input
                    {...register('employee_id', { required: '必須項目です' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="EMP001"
                  />
                  {errors.employee_id && <p className="text-xs text-red-500 mt-1">{errors.employee_id.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
                  <input
                    {...register('name', { required: '必須項目です' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="山田 太郎"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">氏名（カナ）</label>
                  <input
                    {...register('name_kana')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ヤマダ タロウ"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">メールアドレス</label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="yamada@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">部署</label>
                  <input
                    {...register('department')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="開発部"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">雇用形態 *</label>
                  <select
                    {...register('employment_type', { required: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="hourly">時給</option>
                    <option value="daily">日給</option>
                    <option value="monthly">月給</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Wage Settings */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">給与設定</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">時給（円）</label>
                  <input
                    type="number"
                    min="0"
                    {...register('hourly_wage')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">日給（円）</label>
                  <input
                    type="number"
                    min="0"
                    {...register('daily_wage')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">交通費（円）</label>
                  <input
                    type="number"
                    min="0"
                    {...register('transportation')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">固定手当（円）</label>
                  <input
                    type="number"
                    min="0"
                    {...register('fixed_allowance')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">残業割増率</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    {...register('overtime_rate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">深夜割増率</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    {...register('late_night_rate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">休日割増率</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    {...register('holiday_rate')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Account settings */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">アカウント設定</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    パスワード{isEdit ? '（変更する場合のみ）' : ' *'}
                  </label>
                  <input
                    type="password"
                    {...register('password', { required: !isEdit ? '必須項目です' : false })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isEdit ? '変更しない場合は空白' : 'パスワードを設定'}
                  />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <input
                    type="checkbox"
                    id="is_admin"
                    {...register('is_admin')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="is_admin" className="text-sm text-gray-700">管理者権限を付与する</label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {isSaving ? '保存中...' : isEdit ? '変更を保存' : '従業員を追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      showMessage('success', '従業員を無効化しました')
    },
    onError: () => showMessage('error', '操作に失敗しました'),
  })

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleAdd = () => {
    setEditUser(null)
    setModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditUser(user)
    setModalOpen(true)
  }

  const handleDeactivate = async (user: User) => {
    if (!window.confirm(`${user.name}を無効化しますか？`)) return
    await deactivateMutation.mutateAsync(user.id)
  }

  const sortedUsers = [...users].sort((a, b) => a.employee_id.localeCompare(b.employee_id))

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">従業員管理</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <span>+</span>
          従業員を追加
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">社員番号</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">部署</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">雇用形態</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden lg:table-cell">時給</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">権限</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">状態</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                      従業員が登録されていません
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-500 text-xs">{user.employee_id}</td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          {user.name_kana && <p className="text-xs text-gray-400">{user.name_kana}</p>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{user.department ?? '-'}</td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {employmentTypeLabels[user.employment_type]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700 hidden lg:table-cell">
                        {formatCurrency(user.hourly_wage)}/h
                      </td>
                      <td className="px-3 py-3 text-center">
                        {user.is_admin ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">管理者</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">一般</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {user.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">有効</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-500">無効</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                          >
                            編集
                          </button>
                          {user.is_active && (
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                            >
                              無効化
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EmployeeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editUser={editUser}
      />
    </div>
  )
}

export default EmployeesPage
