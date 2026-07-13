'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, EmploymentType } from '@/lib/supabase/types'
import { createEmployee } from './actions'

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  hourly: '時給',
  daily: '日給',
  monthly: '月給',
}

export default function EmployeesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editProfile, setEditProfile] = useState<Profile | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient()
      .from('profiles')
      .select('*')
      .order('employee_id')
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const displayed = showInactive ? profiles : profiles.filter(p => p.is_active)

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          退職者を表示
        </label>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          + 追加
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">従業員がいません</div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => (
            <div
              key={p.id}
              onClick={() => setEditProfile(p)}
              className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors ${!p.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.is_admin && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">管理者</span>}
                  {!p.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">退職</span>}
                </div>
                <p className="text-xs text-gray-400">{p.employee_id} · {EMPLOYMENT_LABELS[p.employment_type]}</p>
              </div>
              <div className="text-xs text-gray-500 text-right shrink-0">
                {p.employment_type === 'hourly' && `¥${p.hourly_wage.toLocaleString()}/h`}
                {p.employment_type === 'daily' && `¥${p.daily_wage.toLocaleString()}/日`}
                {p.employment_type === 'monthly' && `¥${p.hourly_wage.toLocaleString()}/月`}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAdd || editProfile) && (
        <EmployeeModal
          profile={editProfile}
          onClose={() => { setShowAdd(false); setEditProfile(null) }}
          onSaved={fetchProfiles}
        />
      )}
    </div>
  )
}

interface EmployeeModalProps {
  profile?: Profile | null
  onClose: () => void
  onSaved: () => void
}

function EmployeeModal({ profile, onClose, onSaved }: EmployeeModalProps) {
  const [employeeId, setEmployeeId] = useState(profile?.employee_id ?? '')
  const [name, setName] = useState(profile?.name ?? '')
  const [nameKana, setNameKana] = useState(profile?.name_kana ?? '')
  const [department, setDepartment] = useState(profile?.department ?? '')
  const [employmentType, setEmploymentType] = useState<EmploymentType>(profile?.employment_type ?? 'monthly')
  const [hourlyWage, setHourlyWage] = useState(String(profile?.hourly_wage ?? ''))
  const [dailyWage, setDailyWage] = useState(String(profile?.daily_wage ?? ''))
  const [transportation, setTransportation] = useState(String(profile?.transportation ?? ''))
  const [fixedAllowance, setFixedAllowance] = useState(String(profile?.fixed_allowance ?? ''))
  const [overtimeRate, setOvertimeRate] = useState(String(profile?.overtime_rate ?? '1.25'))
  const [holidayRate, setHolidayRate] = useState(String(profile?.holiday_rate ?? '1.35'))
  const [avatarChar, setAvatarChar] = useState(profile?.avatar_char ?? '')
  const [isAdmin, setIsAdmin] = useState(profile?.is_admin ?? false)
  const [isActive, setIsActive] = useState(profile?.is_active ?? true)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!employeeId || !name) return
    setError(null)
    setSaving(true)
    try {
      const supabase = createClient()
      if (profile) {
        await supabase.from('profiles').update({
          employee_id: employeeId,
          name,
          name_kana: nameKana || null,
          department: department || null,
          employment_type: employmentType,
          hourly_wage: Number(hourlyWage) || 0,
          daily_wage: Number(dailyWage) || 0,
          transportation: Number(transportation) || 0,
          fixed_allowance: Number(fixedAllowance) || 0,
          overtime_rate: Number(overtimeRate) || 1.25,
          holiday_rate: Number(holidayRate) || 1.35,
          is_admin: isAdmin,
          is_active: isActive,
          avatar_char: avatarChar || null,
        }).eq('id', profile.id)
      } else {
        if (!password) { setError('パスワードを入力してください'); setSaving(false); return }
        const result = await createEmployee({
          employeeId,
          name,
          nameKana,
          department,
          employmentType,
          hourlyWage: Number(hourlyWage) || 0,
          dailyWage: Number(dailyWage) || 0,
          transportation: Number(transportation) || 0,
          fixedAllowance: Number(fixedAllowance) || 0,
          overtimeRate: Number(overtimeRate) || 1.25,
          holidayRate: Number(holidayRate) || 1.35,
          isAdmin,
          password,
        })
        if (result.error) throw new Error(result.error)
      }
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 my-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">
          {profile ? '従業員を編集' : '従業員を追加'}
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">社員番号 *</label>
              <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="A001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">部署</label>
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">氏名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">氏名（かな）</label>
            <input type="text" value={nameKana} onChange={e => setNameKana(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">雇用形態</label>
            <select value={employmentType} onChange={e => setEmploymentType(e.target.value as EmploymentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="monthly">月給</option>
              <option value="daily">日給</option>
              <option value="hourly">時給</option>
            </select>
          </div>
          {employmentType === 'hourly' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">時給（円）</label>
              <input type="number" value={hourlyWage} onChange={e => setHourlyWage(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {employmentType === 'daily' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">日給（円）</label>
              <input type="number" value={dailyWage} onChange={e => setDailyWage(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          {employmentType === 'monthly' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">月給（円）</label>
              <input type="number" value={hourlyWage} onChange={e => setHourlyWage(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">交通費（円）</label>
              <input type="number" value={transportation} onChange={e => setTransportation(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">固定手当（円）</label>
              <input type="number" value={fixedAllowance} onChange={e => setFixedAllowance(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">残業率</label>
              <input type="number" value={overtimeRate} onChange={e => setOvertimeRate(e.target.value)} step="0.01" min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">休日率</label>
              <input type="number" value={holidayRate} onChange={e => setHolidayRate(e.target.value)} step="0.01" min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {!profile && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">パスワード *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">カレンダー表示文字</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={avatarChar}
                onChange={e => setAvatarChar(e.target.value.slice(0, 1))}
                maxLength={1}
                placeholder="山"
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: '#3b82f6' }}>
                  {avatarChar || '山'}
                </div>
                <span className="text-xs text-gray-400">←カレンダーでの見え方</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-400">名前の頭文字など1文字を入力</p>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
              管理者権限
            </label>
            {profile && (
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                在籍中
              </label>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2">
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !employeeId || !name}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
