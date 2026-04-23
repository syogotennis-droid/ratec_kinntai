import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { useForm } from 'react-hook-form'
import { payrollApi, usersApi, exportApi } from '../services/api'
import { PayrollRecord, User } from '../types'

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

function formatHours(h: number): string {
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  if (minutes === 0) return `${hours}h`
  return `${hours}h${minutes}m`
}

interface AdjustFormData {
  allowances: number
  deductions: number
  additional_notes: string
}

interface PayrollRowProps {
  record: PayrollRecord
  user: User | undefined
  yearMonth: string
  isExpanded: boolean
  onToggle: () => void
  onConfirm: () => void
  isConfirming: boolean
}

const PayrollRow: React.FC<PayrollRowProps> = ({
  record,
  user,
  yearMonth,
  isExpanded,
  onToggle,
  onConfirm,
  isConfirming,
}) => {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset } = useForm<AdjustFormData>({
    defaultValues: {
      allowances: record.allowances,
      deductions: record.deductions,
      additional_notes: record.additional_notes ?? '',
    },
  })

  const adjustMutation = useMutation({
    mutationFn: (data: AdjustFormData) =>
      payrollApi.adjust(yearMonth, record.user_id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-list', yearMonth] })
    },
  })

  const onSubmitAdjust = async (data: AdjustFormData) => {
    await adjustMutation.mutateAsync({
      allowances: Number(data.allowances),
      deductions: Number(data.deductions),
      additional_notes: data.additional_notes,
    })
  }

  return (
    <>
      <tr
        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-medium text-gray-900">{user?.name ?? `ID:${record.user_id}`}</td>
        <td className="px-3 py-3 text-right text-gray-600 hidden md:table-cell">{formatHours(record.regular_hours)}</td>
        <td className="px-3 py-3 text-right text-orange-500 hidden md:table-cell">{record.overtime_hours > 0 ? formatHours(record.overtime_hours) : '-'}</td>
        <td className="px-3 py-3 text-right text-indigo-500 hidden lg:table-cell">{record.late_night_hours > 0 ? formatHours(record.late_night_hours) : '-'}</td>
        <td className="px-3 py-3 text-right text-red-500 hidden lg:table-cell">{record.holiday_hours > 0 ? formatHours(record.holiday_hours) : '-'}</td>
        <td className="px-3 py-3 text-right text-gray-700 hidden sm:table-cell">{formatCurrency(record.base_salary)}</td>
        <td className="px-3 py-3 text-right text-orange-600 hidden sm:table-cell">{record.overtime_pay > 0 ? formatCurrency(record.overtime_pay) : '-'}</td>
        <td className="px-3 py-3 text-right font-bold text-green-700">{formatCurrency(record.gross_pay)}</td>
        <td className="px-3 py-3 text-center">
          {record.status === 'confirmed' ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">確定済み</span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">計算済み</span>
          )}
        </td>
        <td className="px-3 py-3 text-center text-gray-400">
          <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-blue-50 border-b border-blue-200">
          <td colSpan={10} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">給与明細</h3>
                <div className="space-y-1.5">
                  {[
                    { label: '基本給', value: record.base_salary },
                    { label: '残業手当', value: record.overtime_pay },
                    { label: '深夜手当', value: record.late_night_pay },
                    { label: '休日手当', value: record.holiday_pay },
                    { label: '交通費', value: record.transportation },
                    { label: '諸手当', value: record.allowances },
                    { label: '控除', value: -record.deductions, negative: true },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className={`font-medium ${item.negative ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.negative ? `-${formatCurrency(record.deductions)}` : formatCurrency(item.value as number)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                    <span className="text-gray-900">支給総額</span>
                    <span className="text-green-700">{formatCurrency(record.gross_pay)}</span>
                  </div>
                </div>
              </div>

              {/* Adjustment form */}
              {record.status !== 'confirmed' && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">調整</h3>
                  <form onSubmit={handleSubmit(onSubmitAdjust)} className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">諸手当（円）</label>
                      <input
                        type="number"
                        min="0"
                        {...register('allowances')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">控除（円）</label>
                      <input
                        type="number"
                        min="0"
                        {...register('deductions')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">備考</label>
                      <input
                        type="text"
                        {...register('additional_notes')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={adjustMutation.isPending}
                        className="flex-1 px-3 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                      >
                        {adjustMutation.isPending ? '保存中...' : '調整を保存'}
                      </button>
                      <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isConfirming}
                        className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors"
                      >
                        {isConfirming ? '確定中...' : '給与確定'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {record.status === 'confirmed' && (
                <div className="flex items-center">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg w-full text-center">
                    <p className="text-green-700 font-semibold text-sm">給与確定済み</p>
                    {record.confirmed_at && (
                      <p className="text-xs text-green-600 mt-1">
                        確定日時: {new Date(record.confirmed_at).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

const PayrollPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const yearMonth = format(currentDate, 'yyyy-MM')
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: payrollList = [], isLoading } = useQuery<PayrollRecord[]>({
    queryKey: ['payroll-list', yearMonth],
    queryFn: () => payrollApi.list(yearMonth).then((r) => r.data),
  })

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const calculateMutation = useMutation({
    mutationFn: () => payrollApi.calculate(yearMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-list', yearMonth] })
      showMessage('success', '給与計算を実行しました')
    },
    onError: () => showMessage('error', '給与計算に失敗しました'),
  })

  const confirmMutation = useMutation({
    mutationFn: (userId: number) => payrollApi.confirm(yearMonth, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-list', yearMonth] })
      showMessage('success', '給与を確定しました')
    },
    onError: () => showMessage('error', '給与確定に失敗しました'),
  })

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleCalculate = async () => {
    if (!window.confirm(`${format(currentDate, 'yyyy年M月')}の給与計算を実行しますか？`)) return
    setIsCalculating(true)
    try {
      await calculateMutation.mutateAsync()
    } finally {
      setIsCalculating(false)
    }
  }

  const handleConfirm = async (userId: number) => {
    if (!window.confirm('この従業員の給与を確定しますか？確定後は変更できません。')) return
    setConfirmingId(userId)
    try {
      await confirmMutation.mutateAsync(userId)
    } finally {
      setConfirmingId(null)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await exportApi.payroll(yearMonth)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${yearMonth}_給与一覧.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showMessage('error', 'エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const userMap = React.useMemo(() => {
    const map: Record<number, User> = {}
    users.forEach((u) => { map[u.id] = u })
    return map
  }, [users])

  const totalGross = payrollList.reduce((acc, r) => acc + r.gross_pay, 0)
  const confirmedCount = payrollList.filter((r) => r.status === 'confirmed').length

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">給与計算</h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-gray-900 min-w-[120px] text-center">
          {format(currentDate, 'yyyy年M月')}
        </span>
        <button
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
        >
          {isCalculating ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span>💴</span>
          )}
          給与計算実行
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting || payrollList.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <span>📥</span>
          CSVエクスポート
        </button>
      </div>

      {/* Summary */}
      {payrollList.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">対象者数</p>
            <p className="text-xl font-bold text-gray-900">{payrollList.length}<span className="text-sm font-normal text-gray-500">名</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">確定済み</p>
            <p className="text-xl font-bold text-green-600">{confirmedCount}<span className="text-sm font-normal text-gray-500">名</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">給与総額</p>
            <p className="text-base font-bold text-green-700">{formatCurrency(totalGross)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : payrollList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm mb-3">給与データがありません</p>
          <p className="text-gray-400 text-xs">「給与計算実行」ボタンを押してください</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">通常時間</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">残業</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden lg:table-cell">深夜</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden lg:table-cell">休日</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">基本給</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">残業手当</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">支給総額</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">状態</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payrollList.map((record) => (
                  <PayrollRow
                    key={record.user_id}
                    record={record}
                    user={userMap[record.user_id]}
                    yearMonth={yearMonth}
                    isExpanded={expandedUserId === record.user_id}
                    onToggle={() => setExpandedUserId((id) => id === record.user_id ? null : record.user_id)}
                    onConfirm={() => handleConfirm(record.user_id)}
                    isConfirming={confirmingId === record.user_id}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td className="px-4 py-3 font-semibold text-gray-700">合計</td>
                  <td colSpan={6} className="hidden md:table-cell" />
                  <td className="px-3 py-3 text-right font-bold text-green-700">{formatCurrency(totalGross)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default PayrollPage
