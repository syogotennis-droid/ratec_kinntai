'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, EmploymentType } from '@/lib/supabase/types'
import { createEmployee, updateEmployeePassword } from './actions'
import MobileMenuButton from '@/components/ui/MobileMenuButton'

interface EmployeesClientProps {
  initialProfiles: Profile[]
}

export default function EmployeesClient({ initialProfiles }: EmployeesClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [loading, setLoading] = useState(false)
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

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    fetchProfiles()
  }, [fetchProfiles])

  const displayed = showInactive ? profiles : profiles.filter(p => p.is_active)

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <MobileMenuButton />
        <h1 className="text-base font-bold text-gray-900">従業員管理</h1>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            退職者を表示
          </label>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow transition-shadow"
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
              className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:bg-blue-50 cursor-pointer transition-all ${!p.is_active ? 'opacity-50' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.is_admin && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">管理者</span>}
                  {!p.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">退職</span>}
                </div>
                <p className="text-xs text-gray-400">{p.employee_id}</p>
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
  const [department, setDepartment] = useState(profile?.department ?? '')
  // 時給・固定手当・残業率・休日率など給与計算に関わる項目は、別の給与ソフトで
  // 管理しているためこのアプリでは扱わない。データ送信時は既定値を渡す
  // (既存データ・DBスキーマには影響しない)
  const employmentType: EmploymentType = 'hourly'
  const [avatarChar, setAvatarChar] = useState(profile?.avatar_char ?? '')
  const [color, setColor] = useState(profile?.color ?? '')
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
        // 給与関連(時給・日給・交通費・固定手当・残業率・休日率)・氏名（かな）は
        // 入力欄が無いため、既存データを上書きしないよう更新対象に含めない
        await supabase.from('profiles').update({
          employee_id: employeeId,
          name,
          department: department || null,
          is_admin: isAdmin,
          is_active: isActive,
          avatar_char: avatarChar || null,
          color: color || null,
        }).eq('id', profile.id)
        if (password) {
          const result = await updateEmployeePassword(profile.id, password)
          if (result.error) throw new Error(result.error)
        }
      } else {
        if (!password) { setError('パスワードを入力してください'); setSaving(false); return }
        const result = await createEmployee({
          employeeId,
          name,
          nameKana: '',
          department,
          employmentType,
          hourlyWage: 0,
          dailyWage: 0,
          transportation: 0,
          fixedAllowance: 0,
          overtimeRate: 1.25,
          holidayRate: 1.35,
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
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {profile ? 'パスワード（変更する場合のみ入力）' : 'パスワード *'}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">カレンダー表示</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={avatarChar}
                onChange={e => setAvatarChar(e.target.value.slice(0, 1))}
                maxLength={1}
                placeholder="文字"
                className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {avatarChar && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: color || '#3b82f6' }}>
                  {avatarChar}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">名前の頭文字など1文字</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">カラー</label>
            <div className="flex flex-wrap gap-2">
              {['#2563eb','#16a34a','#ea580c','#9333ea','#dc2626','#0891b2','#b45309','#db2777','#475569','#65a30d','#be185d','#7c3aed'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#1f2937' : 'transparent',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
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
