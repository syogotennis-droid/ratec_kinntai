import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import { workRecordsApi, usersApi, payrollApi, closingApi, exportApi } from '../services/api'
import { WorkRecord, User, MonthlySummary } from '../types'
import WorkEntryModal from '../components/WorkEntryModal'
import type { WorkEntryFormData } from '../components/WorkEntryModal'

const workTypeLabels: Record<string, string> = {
  normal: '通常勤務',
  overtime: '残業',
  holiday: '休日出勤',
  training: '研修',
  paid_leave: '有給休暇',
}

const workTypeBadge: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700',
  overtime: 'bg-orange-100 text-orange-700',
  holiday: 'bg-red-100 text-red-700',
  training: 'bg-green-100 text-green-700',
  paid_leave: 'bg-purple-100 text-purple-700',
}

const dayOfWeekLabels = ['日', '月', '火', '水', '木', '金', '土']

function formatHoursHM(minutes: number | null): string {
  if (minutes === null) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}:00`
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

function formatHoursDecimal(h: number): string {
  const hours = Math.floor(h)
  const minutes = Math.round((h - hours) * 60)
  if (minutes === 0) return `${hours}時間`
  return `${hours}時間${minutes}分`
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

// ===================== 従業員詳細ビュー =====================

interface DetailViewProps {
  user: User
  yearMonth: string
  closingStatus: string
  onBack: () => void
  onClosingChanged: () => void
  showMessage: (type: 'success' | 'error', text: string) => void
}

const EmployeeDetailView: React.FC<DetailViewProps> = ({
  user,
  yearMonth,
  closingStatus,
  onBack,
  onClosingChanged,
  showMessage,
}) => {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')

  const { data: workRecords = [], isLoading } = useQuery<WorkRecord[]>({
    queryKey: ['work-records-admin', user.id, yearMonth],
    queryFn: () =>
      workRecordsApi.list({ user_id: user.id, year_month: yearMonth }).then((r) => r.data),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['work-records-admin', user.id, yearMonth] })
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => workRecordsApi.create(data),
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => workRecordsApi.update(id, data),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => workRecordsApi.delete(id),
    onSuccess: invalidate,
  })
  const closeMutation = useMutation({
    mutationFn: () => closingApi.close(yearMonth, user.id),
    onSuccess: () => { onClosingChanged(); showMessage('success', `${user.name}さんの${yearMonth}を締めました`) },
    onError: () => showMessage('error', '締め処理に失敗しました'),
  })
  const reopenMutation = useMutation({
    mutationFn: () => closingApi.reopen(yearMonth, user.id),
    onSuccess: () => { onClosingChanged(); showMessage('success', `${user.name}さんの${yearMonth}を再開しました`) },
    onError: () => showMessage('error', '再開処理に失敗しました'),
  })

  const sorted = [...workRecords].sort((a, b) => a.work_date.localeCompare(b.work_date))
  const totalMinutes = workRecords.reduce((acc, r) => acc + (r.actual_minutes ?? 0), 0)
  const isClosed = closingStatus === 'closed'

  const handleSave = async (formData: WorkEntryFormData) => {
    if (selectedRecord) {
      await updateMutation.mutateAsync({ id: selectedRecord.id, data: { ...formData, user_id: user.id } })
    } else {
      await createMutation.mutateAsync({ ...formData, user_id: user.id })
    }
  }

  const handleDelete = async () => {
    if (selectedRecord) await deleteMutation.mutateAsync(selectedRecord.id)
  }

  const getDayClass = (dateStr: string) => {
    const day = parseISO(dateStr).getDay()
    if (day === 0) return 'text-red-500'
    if (day === 6) return 'text-blue-500'
    return 'text-gray-900'
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          一覧へ戻る
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{user.name}</h1>
          <p className="text-xs text-gray-500">{format(parseISO(yearMonth + '-01'), 'yyyy年M月')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={closingStatus} />
          {isClosed ? (
            <button
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 border border-orange-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {reopenMutation.isPending ? '処理中...' : '再開'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (window.confirm(`${user.name}さんの${yearMonth}を締めますか？`)) closeMutation.mutate()
              }}
              disabled={closeMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {closeMutation.isPending ? '処理中...' : '締める'}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">出勤日数</p>
          <p className="text-xl font-bold text-gray-900">{workRecords.length}<span className="text-sm font-normal text-gray-500">日</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">総実働時間</p>
          <p className="text-xl font-bold text-blue-600">{formatHoursLabel(totalMinutes)}</p>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setSelectedRecord(null)
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
            setModalOpen(true)
          }}
          disabled={isClosed}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
        >
          <span>+</span>
          記録を追加
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">この月の勤務記録はありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">日付</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">曜日</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">開始</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">終了</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden md:table-cell">休憩</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">実働</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">区分</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden lg:table-cell">備考</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((record) => {
                  const d = parseISO(record.work_date)
                  const dayClass = getDayClass(record.work_date)
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className={`px-4 py-3 font-medium ${dayClass}`}>{format(d, 'M/d')}</td>
                      <td className={`px-3 py-3 hidden sm:table-cell ${dayClass}`}>{dayOfWeekLabels[d.getDay()]}</td>
                      <td className="px-3 py-3 text-gray-700">{record.start_time}</td>
                      <td className="px-3 py-3 text-gray-700">{record.end_time}</td>
                      <td className="px-3 py-3 text-gray-500 hidden md:table-cell">
                        {record.break_minutes > 0 ? `${record.break_minutes}分` : '-'}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">{formatHoursHM(record.actual_minutes)}</td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${workTypeBadge[record.work_type] ?? 'bg-gray-100 text-gray-600'}`}>
                          {workTypeLabels[record.work_type] ?? record.work_type}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs hidden lg:table-cell max-w-[150px] truncate">
                        {record.notes ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => { setSelectedRecord(record); setSelectedDate(record.work_date); setModalOpen(true) }}
                          disabled={isClosed}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          編集
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-600">合計 {workRecords.length}日</td>
                  <td colSpan={2} className="px-3 py-3" />
                  <td className="px-3 py-3 hidden md:table-cell" />
                  <td className="px-3 py-3 font-bold text-blue-700">{formatHoursHM(totalMinutes)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <WorkEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={selectedRecord ? handleDelete : undefined}
        initialDate={selectedDate}
        record={selectedRecord}
      />
    </div>
  )
}

// ===================== メインコンポーネント =====================

const AdminWorkListPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const yearMonth = format(currentDate, 'yyyy-MM')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isClosingAll, setIsClosingAll] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data: summaries = [] } = useQuery<MonthlySummary[]>({
    queryKey: ['monthly-summary', yearMonth],
    queryFn: () => payrollApi.summary(yearMonth).then((r) => r.data),
  })

  const { data: closingStatus = [], refetch: refetchClosing } = useQuery<any[]>({
    queryKey: ['closing-status', yearMonth],
    queryFn: () => closingApi.status(yearMonth).then((r) => r.data),
  })

  const closingMap = useMemo(() => {
    const map: Record<number, string> = {}
    if (Array.isArray(closingStatus)) {
      closingStatus.forEach((c: any) => { map[c.user_id] = c.status })
    }
    return map
  }, [closingStatus])

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

  const handleCalculate = async () => {
    if (!window.confirm(`${format(currentDate, 'yyyy年M月')}の月次集計を実行しますか？`)) return
    setIsCalculating(true)
    try { await calculateMutation.mutateAsync() } finally { setIsCalculating(false) }
  }

  const handleCloseAll = async () => {
    if (!window.confirm(`${format(currentDate, 'yyyy年M月')}の全員の月次締めを実行しますか？`)) return
    setIsClosingAll(true)
    try { await closeAllMutation.mutateAsync() } finally { setIsClosingAll(false) }
  }

  const handleExport = async (type: 'work' | 'payroll') => {
    setIsExporting(true)
    try {
      const res = type === 'work' ? await exportApi.workRecords(yearMonth) : await exportApi.payroll(yearMonth)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `${yearMonth}_${type === 'work' ? '勤務一覧' : '給与一覧'}.csv`
      a.click(); URL.revokeObjectURL(url)
    } catch { showMessage('error', 'エクスポートに失敗しました') }
    finally { setIsExporting(false) }
  }

  const activeUsers = users.filter((u) => u.is_active && !u.is_admin)
  const totalCount = activeUsers.length
  const closedCount = Object.values(closingMap).filter((s) => s === 'closed').length
  const openCount = totalCount - closedCount

  const selectedUser = users.find((u) => u.id === selectedUserId)

  // 詳細ビュー
  if (selectedUserId !== null && selectedUser) {
    return (
      <>
        {message && (
          <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}
        <EmployeeDetailView
          user={selectedUser}
          yearMonth={yearMonth}
          closingStatus={closingMap[selectedUserId] ?? 'open'}
          onBack={() => setSelectedUserId(null)}
          onClosingChanged={() => {
            refetchClosing()
            queryClient.invalidateQueries({ queryKey: ['monthly-summary', yearMonth] })
          }}
          showMessage={showMessage}
        />
      </>
    )
  }

  // 一覧ビュー
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-900">勤務管理</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setCurrentDate((d) => subMonths(d, 1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-base font-semibold text-gray-900 min-w-[120px] text-center">
          {format(currentDate, 'yyyy年M月')}
        </span>
        <button onClick={() => setCurrentDate((d) => addMonths(d, 1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors">
          今月
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '総勤務者数', value: totalCount, unit: '名', color: 'text-gray-900' },
          { label: '締め済み', value: closedCount, unit: '名', color: 'text-green-600' },
          { label: '未締め', value: openCount, unit: '名', color: 'text-yellow-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-xl font-bold ${card.color}`}>
              {card.value}<span className="text-sm font-normal text-gray-500 ml-0.5">{card.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
        >
          {isCalculating ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <span>📊</span>}
          月次集計実行
        </button>
        <button
          onClick={handleCloseAll}
          disabled={isClosingAll}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg transition-colors"
        >
          {isClosingAll ? <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <span>🔒</span>}
          全員締め
        </button>
        <button onClick={() => handleExport('work')} disabled={isExporting} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50">
          <span>📥</span>勤務CSV
        </button>
        <button onClick={() => handleExport('payroll')} disabled={isExporting} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50">
          <span>📥</span>給与CSV
        </button>
      </div>

      {/* Employee summary table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">従業員別月次集計</h2>
        </div>
        {summaries.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">データがありません（月次集計を実行してください）</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">出勤日数</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500">総実働</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">残業</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">ステータス</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">締め操作</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.map((s) => {
                  const status = closingMap[s.user_id] ?? 'open'
                  const isClosed = status === 'closed'
                  return (
                    <tr key={s.user_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{s.user_name}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{s.work_days}日</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">{formatHoursDecimal(s.total_hours)}</td>
                      <td className="px-3 py-3 text-right text-orange-500 hidden md:table-cell">
                        {s.overtime_hours > 0 ? formatHoursDecimal(s.overtime_hours) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <IndividualCloseButton
                          userId={s.user_id}
                          userName={s.user_name}
                          yearMonth={yearMonth}
                          isClosed={isClosed}
                          onDone={() => {
                            queryClient.invalidateQueries({ queryKey: ['closing-status', yearMonth] })
                            queryClient.invalidateQueries({ queryKey: ['monthly-summary', yearMonth] })
                          }}
                          showMessage={showMessage}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => setSelectedUserId(s.user_id)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ===================== 個別締めボタン =====================

interface IndividualCloseButtonProps {
  userId: number
  userName: string
  yearMonth: string
  isClosed: boolean
  onDone: () => void
  showMessage: (type: 'success' | 'error', text: string) => void
}

const IndividualCloseButton: React.FC<IndividualCloseButtonProps> = ({
  userId, userName, yearMonth, isClosed, onDone, showMessage,
}) => {
  const closeMutation = useMutation({
    mutationFn: () => closingApi.close(yearMonth, userId),
    onSuccess: () => { onDone(); showMessage('success', `${userName}さんを締めました`) },
    onError: () => showMessage('error', '締め処理に失敗しました'),
  })
  const reopenMutation = useMutation({
    mutationFn: () => closingApi.reopen(yearMonth, userId),
    onSuccess: () => { onDone(); showMessage('success', `${userName}さんの締めを解除しました`) },
    onError: () => showMessage('error', '再開処理に失敗しました'),
  })

  const isPending = closeMutation.isPending || reopenMutation.isPending

  if (isClosed) {
    return (
      <button
        onClick={() => reopenMutation.mutate()}
        disabled={isPending}
        className="px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 border border-orange-300 rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? '...' : '再開'}
      </button>
    )
  }
  return (
    <button
      onClick={() => {
        if (window.confirm(`${userName}さんの${yearMonth}を締めますか？`)) closeMutation.mutate()
      }}
      disabled={isPending}
      className="px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 border border-green-300 rounded-lg transition-colors disabled:opacity-50"
    >
      {isPending ? '...' : '締める'}
    </button>
  )
}

export default AdminWorkListPage
