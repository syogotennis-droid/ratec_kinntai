import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format, addMonths, subMonths } from 'date-fns'
import { salesApi, bonusApi } from '../services/api'
import { Bonus, MonthlySalesSummary } from '../types'

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface BonusRowProps {
  summary: MonthlySalesSummary
  bonus: Bonus | undefined
  yearMonth: string
}

const BonusRow: React.FC<BonusRowProps> = ({ summary, bonus, yearMonth }) => {
  const [bonusAmount, setBonusAmount] = useState<string>(
    bonus?.bonus_amount != null ? String(bonus.bonus_amount) : ''
  )
  const [notes, setNotes] = useState<string>(bonus?.notes ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when bonus data changes (e.g. after initial load)
  React.useEffect(() => {
    setBonusAmount(bonus?.bonus_amount != null ? String(bonus.bonus_amount) : '')
    setNotes(bonus?.notes ?? '')
    setSaved(false)
  }, [bonus?.bonus_amount, bonus?.notes])

  const updateMutation = useMutation({
    mutationFn: (data: { bonus_amount: number; notes: string }) =>
      bonusApi.update(yearMonth, summary.user_id, data),
  })

  const handleSave = async () => {
    const amount = parseInt(bonusAmount.replace(/,/g, ''), 10)
    if (isNaN(amount) || amount < 0) {
      setError('0以上の数値を入力してください')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ bonus_amount: amount, notes })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-4">
        <div>
          <p className="text-sm font-medium text-gray-900">{summary.user_name}</p>
          <p className="text-xs text-gray-400">{summary.employee_id}</p>
        </div>
      </td>
      <td className="px-3 py-4 text-right text-sm text-gray-700 hidden sm:table-cell whitespace-nowrap">
        {formatYen(summary.total_sales)}
      </td>
      <td className="px-3 py-4 text-right text-sm text-orange-600 hidden md:table-cell whitespace-nowrap">
        {formatYen(summary.total_material)}
      </td>
      <td className="px-3 py-4 text-right text-sm font-medium hidden sm:table-cell whitespace-nowrap">
        <span className={summary.total_profit >= 0 ? 'text-blue-600' : 'text-red-600'}>
          {formatYen(summary.total_profit)}
        </span>
      </td>
      <td className="px-3 py-4">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="0"
          value={bonusAmount}
          onChange={(e) => {
            setBonusAmount(e.target.value)
            setSaved(false)
            setError(null)
          }}
          className={`w-32 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </td>
      <td className="px-3 py-4 hidden lg:table-cell">
        <input
          type="text"
          placeholder="備考"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setSaved(false)
          }}
          className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              saved
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                保存中
              </span>
            ) : saved ? (
              '保存済み ✓'
            ) : (
              '保存'
            )}
          </button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      </td>
    </tr>
  )
}

const BonusPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const yearMonth = format(currentDate, 'yyyy-MM')

  const { data: monthlySummaries = [], isLoading: summaryLoading } = useQuery<MonthlySalesSummary[]>({
    queryKey: ['bonus-sales-summary', yearMonth],
    queryFn: () => salesApi.monthly(yearMonth).then((r) => r.data),
  })

  const { data: bonusData = [], isLoading: bonusLoading } = useQuery<Bonus[]>({
    queryKey: ['bonuses', yearMonth],
    queryFn: () => bonusApi.list(yearMonth).then((r) => r.data),
  })

  const bonusMap = React.useMemo(() => {
    const map: Record<number, Bonus> = {}
    bonusData.forEach((b) => {
      map[b.user_id] = b
    })
    return map
  }, [bonusData])

  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const res = await bonusApi.exportCsv(yearMonth)
      downloadBlob(res.data, `${yearMonth}_ボーナス一覧.csv`)
    } catch {
      setExportError('エクスポートに失敗しました')
      setTimeout(() => setExportError(null), 4000)
    } finally {
      setIsExporting(false)
    }
  }

  const isLoading = summaryLoading || bonusLoading

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-gray-900">ボーナス管理</h1>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <span>📥</span>
          <span className="hidden sm:inline">CSV</span>エクスポート
        </button>
      </div>

      {/* Export error */}
      {exportError && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {exportError}
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
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
        >
          今月
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : monthlySummaries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">この月の売上データがありません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">
              ボーナス入力
              <span className="ml-2 text-xs text-gray-400 font-normal">
                各行で個別に保存してください
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">氏名</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">月次売上</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden md:table-cell">材料費</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 hidden sm:table-cell">利益</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">ボーナス（円）</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 hidden lg:table-cell">備考</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaries.map((summary) => (
                  <BonusRow
                    key={summary.user_id}
                    summary={summary}
                    bonus={bonusMap[summary.user_id]}
                    yearMonth={yearMonth}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default BonusPage
