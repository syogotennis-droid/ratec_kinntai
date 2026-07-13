'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings } from '@/lib/supabase/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [companyName, setCompanyName] = useState('')
  const [companyPostal, setCompanyPostal] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyTel, setCompanyTel] = useState('')
  const [companyFax, setCompanyFax] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankBranch, setBankBranch] = useState('')
  const [bankType, setBankType] = useState('普通')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  useEffect(() => {
    createClient().from('settings').select('*').single().then(({ data }) => {
      if (data) {
        setSettings(data)
        setCompanyName(data.company_name)
        setCompanyPostal(data.company_postal)
        setCompanyAddress(data.company_address)
        setCompanyTel(data.company_tel)
        setCompanyFax(data.company_fax)
        setCompanyEmail(data.company_email)
        setBankName(data.bank_name)
        setBankBranch(data.bank_branch)
        setBankType(data.bank_type)
        setBankAccount(data.bank_account)
        setBankHolder(data.bank_holder)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setError(null)
    setSaving(true)
    try {
      await createClient().from('settings').update({
        company_name: companyName,
        company_postal: companyPostal,
        company_address: companyAddress,
        company_tel: companyTel,
        company_fax: companyFax,
        company_email: companyEmail,
        bank_name: bankName,
        bank_branch: bankBranch,
        bank_type: bankType,
        bank_account: bankAccount,
        bank_holder: bankHolder,
      }).eq('id', settings.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">読み込み中...</div>

  return (
    <div className="p-4 max-w-lg">
      <h2 className="text-sm font-bold text-gray-900 mb-4">自社設定</h2>

      <section className="mb-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">会社情報</h3>
        <div className="space-y-3">
          <Field label="会社名" value={companyName} onChange={setCompanyName} />
          <Field label="郵便番号" value={companyPostal} onChange={setCompanyPostal} />
          <Field label="住所" value={companyAddress} onChange={setCompanyAddress} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="電話" value={companyTel} onChange={setCompanyTel} />
            <Field label="FAX" value={companyFax} onChange={setCompanyFax} />
          </div>
          <Field label="メールアドレス" value={companyEmail} onChange={setCompanyEmail} type="email" />
        </div>
      </section>

      <section className="mb-6">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">銀行口座</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="銀行名" value={bankName} onChange={setBankName} />
            <Field label="支店名" value={bankBranch} onChange={setBankBranch} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">口座種別</label>
              <select value={bankType} onChange={e => setBankType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>普通</option>
                <option>当座</option>
              </select>
            </div>
            <Field label="口座番号" value={bankAccount} onChange={setBankAccount} />
          </div>
          <Field label="口座名義" value={bankHolder} onChange={setBankHolder} />
        </div>
      </section>

      {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
      >
        {saved ? '保存しました' : saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
