import React from 'react'

const SettingsPage: React.FC = () => {
  const systemInfo = [
    { label: 'システム名', value: 'RATEC 勤怠・給与計算システム' },
    { label: 'バージョン', value: 'v0.1.0' },
    { label: 'フロントエンド', value: 'React 18 + TypeScript + Vite' },
    { label: 'UI フレームワーク', value: 'Tailwind CSS v3' },
    { label: 'バックエンド', value: 'FastAPI (Python)' },
    { label: '最終更新', value: new Date().toLocaleDateString('ja-JP') },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900">設定</h1>
        <p className="text-sm text-gray-500 mt-1">システム設定</p>
      </div>

      {/* Placeholder Notice */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
        <span className="text-yellow-500 text-xl flex-shrink-0">⚙️</span>
        <div>
          <p className="text-sm font-semibold text-yellow-800">設定機能は準備中です</p>
          <p className="text-xs text-yellow-700 mt-1">
            詳細な設定機能は今後のアップデートで追加される予定です。
          </p>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">システム情報</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {systemInfo.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Planned Features */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">予定している設定項目</h2>
        </div>
        <div className="px-4 py-4">
          <ul className="space-y-2">
            {[
              '勤務時間のデフォルト設定（所定労働時間、深夜時間帯等）',
              '祝日カレンダーの設定',
              '有給休暇の管理設定',
              '給与計算ルールのカスタマイズ',
              'メール通知設定',
              'データバックアップ・エクスポート設定',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
