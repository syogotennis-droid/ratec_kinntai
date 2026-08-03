'use client'

import { useRef } from 'react'

interface PhotoPickerProps {
  preview?: string | null
  onChange: (file: File) => void
  onRemove: () => void
  label?: string
}

export default function PhotoPicker({ preview, onChange, onRemove, label }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
          e.target.value = ''
        }}
      />
      {preview ? (
        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label ?? '写真'} className="w-full h-full object-cover" />
          <button type="button" onClick={onRemove} title="削除" aria-label="写真を削除"
            className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white text-xs hover:bg-black/70">
            ×
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-24 h-24 flex flex-col items-center justify-center gap-1 border border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors text-[11px]">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          写真を追加
        </button>
      )}
    </div>
  )
}
