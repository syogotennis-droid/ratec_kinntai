import React, { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase/config'
import { firestoreCreateUser } from '../firebase/firestore'

interface Props {
  onComplete: () => void
}

const SetupPage: React.FC<Props> = ({ onComplete }) => {
  const [name, setName] = useState('')
  const [employeeId, setEmployeeId] = useState('A001')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !employeeId || password.length < 6) {
      setError('全ての項目を入力してください（パスワードは6文字以上）')
      return
    }
    setLoading(true)
    setError('')
    try {
      const email = `${employeeId}@ratec.local`
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await firestoreCreateUser(cred.user.uid, {
        employee_id: employeeId,
        name,
        name_kana: '',
        email,
        department: '管理',
        employment_type: 'fixed',
        hourly_wage: 0,
        daily_wage: 0,
        transportation: 0,
        fixed_allowance: 0,
        overtime_rate: 1.25,
        late_night_rate: 1.25,
        holiday_rate: 1.35,
        is_admin: true,
        is_active: true,
      })
      onComplete()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'エラーが発生しました'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">初期セットアップ</h1>
        <p className="text-gray-500 text-sm mb-6">管理者アカウントを作成してください</p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">社員番号</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="A001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="管理者"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="パスワード"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium hover:bg-blue-700 disabled:opacity-50 mt-2"
          >
            {loading ? '作成中...' : '管理者アカウントを作成'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupPage
