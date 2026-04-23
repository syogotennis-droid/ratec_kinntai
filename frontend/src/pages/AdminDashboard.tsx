import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { payrollApi, closingApi, exportApi } from '../services/api'
import { MonthlySummary } from '../types'

function formatHours(h: number): string {
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  if (minutes === 0) return `${hours}時間`
  return `${hours}時間${minutes}分`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { label: string; className: string }> = {
    closed: { label: '締め済み', className: 'bg-green-100 text-green-700' },
    open: { label: '未締め', className: 'bg-yellow-100 text-yellow-700' },
    confirmed: { label: '給与確定', className: 'bg-blue-100 text-blue-700' },
  }
  const c = config[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const yearMonth = format(currentDate, 'yyyy-MM')
  const [isCalculating, setIsCalculating] = useState(false)
  const [isClosingAll, setIsClosingAll] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: summaries = [], isLoading } = useQuery<MonthlySummary[]>({
    queryKey: ['monthly-summary', yearMonth],
    queryFn: () => payrollApi.summary(yearMonth).then((r) => r.data),
  })

  const { data: closingStatus = [] } = useQuery<any[]>({
    queryKey: ['closing-status', yearMonth],
    queryFn: () => closingApi.status(yearMonth).then((r) => r.data),
  })

  const calculateMutation = useMutation({
    mutationFn: () => payrollApi.calculate(yearMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-summary', yearMonth] })
      showMessage('success', '月次集計を実行しました')
    },
    onError: () => showMessage('error', '月次集計に失敗しました'),
  })

  const closeAllMutation = useMutation({
    mutationFn: () => closingApi.closeAll(yearMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closing-status', yearMonth] })
      queryClient.invalidateQueries({ queryKey: ['monthly-summary', yearMonth] })
      showMessage('success', '全員の月次締めを実行しました')
    },
    onError: () => showMessage('error', '月次締めに失敗しました'),
  })

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const handleCalculate = async () => {
    if (!window.confirm(`${format(currentDate, 'yyyy年M月')}の月次集計を実行しますか？`)) return
    setIsCalculating(true)
    try {
      await calculateMutation.mutateAsync()
    } finally {
      setIsCalculating(false)
    }
  }

  const handleCloseAll = async () => {
    if (!window.confirm(`${format(currentDate, 'yyyy年M月')}の全員の月次締めを実行しますか？`)) return
    setIsClosingAll(true)
    try {
      await closeAllMutation.mutateAsync()
    } finally {
      setIsClosingAll(false)
    }
  }

  const handleExport = async (type: 'work' | 'payroll') => {
    setIsExporting(true)
    try {
      const res = type === 'work'
        ? await exportApi.workRecords(yearMonth)
        : await exportApi.payroll(yearMonth)
      downloadBlob(res.data, `${yearMonth}_${type === 'work' ? '勤務一覧' : '給与一覧'}.csv`)
    } catch {
      showMessage('error', 'エクスポートに失敗しました')
    } finally {
      setIsExporting(false)
    }
  }

  const closingMap = React.useMemo(() => {
    const map: Record<number, string> = {}
    if (Array.isArray(closingStatus)) {
      closingStatus.forEach((c: any) => {
        map[c.user_id] = c.status
      })
    }
    return map
  }, [closingStatus])

  const totalCount = summaries.length
  const closedCount = Object.values(closingMap).filter((s) => s === 'closed').length
  const openCount = totalCount - closedCount

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">管理者ダッシュボード</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-6">
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
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
        >
          今月
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: '総勤務者数', value: totalCount, unit: '名', color: 'text-gray-900' },
          { label: '締め済み', value: closedCount, unit: '名', color: 'text-green-600' },
          { label: '未締め', value: openCount, unit: '名', color: 'text-yellow-600' },
          { label: '給与確定', value: summaries.filter((s) => closingMap[s.user_id] === 'closed').length, unit: '名', color: 'text-blue-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>
              {card.value}
              <span className="text-sm font-normal text-gray-500 ml-0.5">{card.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
        >
          {isCalculating ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span>📊</span>
          )}
          月次集計実行
        </button>
        <button
          onClick={handleCloseAll}
          disabled={isClosingAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors"
        >
          {isClosingAll ? (
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <span>🔒</span>
          )}
          全員締め
        </button>
        <button
          onClick={() => handleExport('work')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <span>📥</span>
          勤務一覧CSV
        </button>
        <button
          onClick={() => handleExport('payroll')}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <span>📥</span>
          給与一覧CSV
        </button>
      </div>

      {/* Unsubmitted warning */}
      {openCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <span className="text-yellow-500">⚠</span>
          <p className="text-sm text-yellow-700">
            {openCount}名の従業員が未締めです。月次締め処理を行ってください。
          </p>
        </div>
      )}

      {/* Employee summary table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">従業員別月次集計</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">出勤日数</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">総実働</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">残業</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">深夜</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden lg:table-cell">休日</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  summaries.map((s) => (
                    <tr key={s.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.user_name}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{s.work_days}日</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{formatHours(s.total_hours)}</td>
                      <td className="px-3 py-3 text-right text-orange-500 hidden md:table-cell">
                        {s.overtime_hours > 0 ? formatHours(s.overtime_hours) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-indigo-500 hidden md:table-cell">
                        {s.late_night_hours > 0 ? formatHours(s.late_night_hours) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-red-500 hidden lg:table-cell">
                        {s.holiday_hours > 0 ? formatHours(s.holiday_hours) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={closingMap[s.user_id] ?? 'open'} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
