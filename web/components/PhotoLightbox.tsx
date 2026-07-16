'use client'

import { useState } from 'react'

interface PhotoLightboxProps {
  url: string
  filename?: string
  onClose: () => void
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

export default function PhotoLightbox({ url, filename, onClose }: PhotoLightboxProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadImage(url, filename || `photo-${Date.now()}.jpg`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <img src={url} alt="" className="max-w-full max-h-[75vh] rounded-lg object-contain shadow-lg" />
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg shadow-sm hover:bg-gray-100 disabled:opacity-60"
          >
            {downloading ? '保存中...' : '画像を保存'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-white/10 text-white border border-white/30 rounded-lg hover:bg-white/20"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
