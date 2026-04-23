import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addMonths, subMonths, parseISO } from 'date-fns'
import { workRecordsApi, payrollApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { WorkRecord, PayrollRecord } from '../types'
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

function formatHours(minutes: number): string {
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

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

const WorkListPage: React.FC = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const yearMonth = format(currentDate, 'yyyy-MM')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<WorkRecord | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')

  const { data: workRecords = [], isLoading } = useQuery<WorkRecord[]>({
    queryKey: ['work-records', user?.id, yearMonth],
    queryFn: () =>
      workRecordsApi.list({ user_id: user!.id, year_month: yearMonth }).then((r) => r.data),
    enabled: !!user,
  })

  const { data: payroll } = useQuery<PayrollRecord>({
    queryKey: ['payroll', user?.id, yearMonth],
    queryFn: () => payrollApi.get(yearMonth, user!.id).then((r) => r.data),
    enabled: !!user,
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => workRecordsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records', user?.id, yearMonth] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workRecordsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-records', user?.id, yearMonth] })
    },
  })

  const sorted = [...workRecords].sort((a, b) => a.work_date.localeCompare(b.work_date))
  const totalMinutes = workRecords.reduce((acc, r) => acc + (r.actual_minutes ?? 0), 0)
  const totalDays = workRecords.length

  const handlePrevMonth = () => setCurrentDate((d) => subMonths(d, 1))
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1))
  const handleToday = () => setCurrentDate(new Date())

  const handleEditRecord = (record: WorkRecord) => {
    setSelectedRecord(record)
    setSelectedDate(record.work_date)
    setModalOpen(true)
  }

  const handleSave = async (formData: WorkEntryFormData) => {
    if (selectedRecord) {
      await updateMutation.mutateAsync({ id: selectedRecord.id, data: { ...formData, user_id: user!.id } })
    }
  }

  const handleDelete = async () => {
    if (selectedRecord) {
      await deleteMutation.mutateAsync(selectedRecord.id)
    }
  }

  const getDayClass = (dateStr: string) => {
    const d = parseISO(dateStr)
    const day = d.getDay()
    if (day === 0) return 'text-red-500'
    if (day === 6) return 'text-blue-500'
    return 'text-gray-900'
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">勤務一覧</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handlePrevMonth}
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
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
        >
          今月
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">出勤日数</p>
          <p className="text-xl font-bold text-gray-900">{totalDays}<span className="text-sm font-normal text-gray-500 ml-0.5">日</span></p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">総実働時間</p>
          <p className="text-xl font-bold text-blue-600">{formatHoursLabel(totalMinutes)}</p>
        </div>
        {payroll && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">残業時間</p>
              <p className="text-xl font-bold text-orange-500">{payroll.overtime_hours.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-0.5">h</span></p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">支給予定額</p>
              <p className="text-base font-bold text-green-600">{formatCurrency(payroll.gross_pay)}</p>
            </div>
          </>
        )}
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
                  const dayOfWeek = d.getDay()
                  const dayClass = getDayClass(record.work_date)
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className={`px-4 py-3 font-medium ${dayClass}`}>
                        {format(d, 'M/d')}
                      </td>
                      <td className={`px-3 py-3 hidden sm:table-cell ${dayClass}`}>
                        {dayOfWeekLabels[dayOfWeek]}
                      </td>
                      <td className="px-3 py-3 text-gray-700">{record.start_time}</td>
                      <td className="px-3 py-3 text-gray-700">{record.end_time}</td>
                      <td className="px-3 py-3 text-gray-500 hidden md:table-cell">
                        {record.break_minutes > 0 ? `${record.break_minutes}分` : '-'}
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {record.actual_minutes ? formatHours(record.actual_minutes) : '-'}
                      </td>
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
                          onClick={() => handleEditRecord(record)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
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
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-600">
                    合計 {totalDays}日
                  </td>
                  <td colSpan={2} className="px-3 py-3" />
                  <td className="px-3 py-3 hidden md:table-cell" />
                  <td className="px-3 py-3 font-bold text-blue-700">
                    {formatHours(totalMinutes)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Preview */}
      {payroll && (
        <div className="mt-5 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            給与予定（{payroll.status === 'confirmed' ? '確定済み' : '計算済み'}）
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
            {[
              { label: '基本給', value: formatCurrency(payroll.base_salary) },
              { label: '残業手当', value: formatCurrency(payroll.overtime_pay) },
              { label: '深夜手当', value: formatCurrency(payroll.late_night_pay) },
              { label: '休日手当', value: formatCurrency(payroll.holiday_pay) },
              { label: '交通費', value: formatCurrency(payroll.transportation) },
              { label: '支給総額', value: formatCurrency(payroll.gross_pay), highlight: true },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg p-2.5 ${item.highlight ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                <p className="text-xs text-gray-500 mb-0.5">{item.label}</p>
                <p className={`text-sm font-bold ${item.highlight ? 'text-green-700' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
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

export default WorkListPage
