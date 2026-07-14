'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PayrollRow, calcPayroll } from './calc'

interface PayrollClientProps {
  initialYearMonth: string
  initialRows: PayrollRow[]
}

export default function PayrollClient({ initialYearMonth, initialRows }: PayrollClientProps) {
  const [yearMonth, setYearMonth] = useState(initialYearMonth)
  const [rows, setRows] = useState<PayrollRow[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<PayrollRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = yearMonth.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    const [profilesRes, recordsRes, bonusesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('employee_id'),
      supabase.from('work_records').select('*')
        .gte('work_date', `${yearMonth}-01`)
        .lte('work_date', `${yearMonth}-${String(lastDay).padStart(2, '0')}`),
      supabase.from('bonuses').select('*').eq('year_month', yearMonth),
    ])
    const profiles = profilesRes.data ?? []
    const records = recordsRes.data ?? []
    const bonuses = bonusesRes.data ?? []

    const result: PayrollRow[] = profiles.map(profile => {
      const userRecords = records.filter(r => r.user_id === profile.id)
      const bonus = bonuses.find(b => b.user_id === profile.id)?.bonus_amount ?? 0
      return { profile, ...calcPayroll(profile, userRecords, bonus) }
    })
    setRows(result)
    setLoading(false)
  }, [yearMonth])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchData()
  }, [fetchData])

  const totalPayroll = rows.reduce((s, r) => s + r.totalSalary, 0)

  const prevMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-lg">‹</button>
        <span className="text-sm font-bold text-gray-900">{yearMonth.replace('-', '年')}月</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-lg">›</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500">総支給額 ¥{totalPayroll.toLocaleString()}</span>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600 text-xs">氏名</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">出勤</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">通常H</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">残業H</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">基本給</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">残業代</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">手当</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600 text-xs">支給額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.profile.id}
                  onClick={() => setDetail(row)}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3">
                    <p className="font-medium text-gray-900">{row.profile.name}</p>
                    <p className="text-xs text-gray-400">{row.profile.employee_id}</p>
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700">{row.workDays}日</td>
                  <td className="py-3 px-3 text-right text-gray-700">{row.regularHours.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{row.overtimeHours.toFixed(1)}</td>
                  <td className="py-3 px-3 text-right text-gray-700">¥{row.baseSalary.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-gray-700">¥{row.overtimePay.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right text-gray-700">
                    ¥{(row.transportation + row.fixedAllowance + row.bonusAmount).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-gray-900">
                    ¥{row.totalSalary.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={7} className="py-3 px-3 text-right text-sm font-bold text-gray-900">合計</td>
                <td className="py-3 px-3 text-right font-bold text-gray-900">¥{totalPayroll.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-900 mb-1">{detail.profile.name}</h2>
            <p className="text-xs text-gray-500 mb-4">{yearMonth.replace('-', '年')}月 給与明細</p>
            <div className="space-y-2 text-sm">
              {[
                { label: '出勤日数', value: `${detail.workDays}日` },
                { label: '通常勤務', value: `${detail.regularHours.toFixed(1)}h` },
                { label: '残業時間', value: `${detail.overtimeHours.toFixed(1)}h` },
                { label: '休日時間', value: `${detail.holidayHours.toFixed(1)}h` },
                { label: '基本給', value: `¥${detail.baseSalary.toLocaleString()}` },
                { label: '残業代', value: `¥${detail.overtimePay.toLocaleString()}` },
                { label: '休日手当', value: `¥${detail.holidayPay.toLocaleString()}` },
                { label: '交通費', value: `¥${detail.transportation.toLocaleString()}` },
                { label: '固定手当', value: `¥${detail.fixedAllowance.toLocaleString()}` },
                { label: 'ボーナス', value: `¥${detail.bonusAmount.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-600">{label}</span>
                  <span className="text-gray-900">{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-bold text-base">
                <span>支給合計</span>
                <span>¥{detail.totalSalary.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setDetail(null)}
              className="mt-4 w-full py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
