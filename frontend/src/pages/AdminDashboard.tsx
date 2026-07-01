import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { systemApi } from '../services/api'

const FIRESTORE_FREE_LIMIT_BYTES = 1024 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const AdminDashboard: React.FC = () => {
  const { data: usageStats } = useQuery<{ photoCount: number; estimatedPhotoBytes: number }>({
    queryKey: ['usage-stats'],
    queryFn: () => systemApi.usage().then((r) => r.data),
  })

  const usagePercent = usageStats
    ? Math.min(100, (usageStats.estimatedPhotoBytes / FIRESTORE_FREE_LIMIT_BYTES) * 100)
    : 0

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-xs text-gray-400">{format(new Date(), 'yyyy年M月d日')}</p>
      </div>

      {/* Storage usage */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">データ使用量（写真）</h2>
          {usageStats && (
            <span className="text-xs text-gray-500">
              {usageStats.photoCount}枚 / 概算{formatBytes(usageStats.estimatedPhotoBytes)}
            </span>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mb-2">
          <div
            className={`h-2.5 rounded-full transition-all ${
              usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            無料枠の目安 {formatBytes(FIRESTORE_FREE_LIMIT_BYTES)}
          </p>
          <p className="text-xs font-medium text-gray-600">
            {usagePercent.toFixed(1)}%
          </p>
        </div>
        {usagePercent > 80 && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">⚠ 使用量が80%を超えています。古い写真の整理を検討してください。</p>
          </div>
        )}
        {usagePercent > 50 && usagePercent <= 80 && (
          <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-700">使用量が50%を超えました。引き続き写真の管理にご注意ください。</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800 mb-1">勤務管理・給与計算について</p>
        <p className="text-xs text-blue-700">
          月次集計・締め処理・CSV出力などは左メニューの「勤務管理」から行えます。
        </p>
      </div>
    </div>
  )
}

export default AdminDashboard
