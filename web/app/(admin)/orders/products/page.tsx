'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Product } from '@/lib/supabase/types'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('products').select('*').order('code')
    setProducts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  const displayed = products.filter(p =>
    !search || p.code.toLowerCase().includes(search.toLowerCase()) || p.name.includes(search) || p.maker.includes(search)
  )

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) throw new Error('データが空です')

      // ヘッダー行をスキップ、カンマまたはタブ区切り対応
      const sep = lines[0].includes('\t') ? '\t' : ','
      const rows = lines.slice(1).map(l => l.split(sep).map(v => v.replace(/^"|"$/g, '').trim()))

      // CSV形式: 品番,品名,仕様,単位,単価,メーカー
      const records = rows.filter(r => r.length >= 2 && r[0]).map(r => ({
        code: r[0] ?? '',
        name: r[1] ?? '',
        spec: r[2] ?? '',
        unit: r[3] || '台',
        unit_price: parseInt(r[4]?.replace(/[^\d]/g, '') ?? '0') || 0,
        maker: r[5] ?? '',
      }))

      if (records.length === 0) throw new Error('有効なデータがありません')

      const supabase = createClient()
      // 既存の同一品番を upsert
      const BATCH = 100
      let count = 0
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH)
        const { error } = await supabase.from('products').upsert(batch, { onConflict: 'code' })
        if (error) throw new Error(error.message)
        count += batch.length
      }
      setImportResult(`${count}件インポート完了`)
      fetchProducts()
    } catch (e) {
      setImportResult(`エラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('削除しますか？')) return
    await createClient().from('products').delete().eq('id', id)
    fetchProducts()
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="品番・品名・メーカーで検索"
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap">
          + 追加
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg whitespace-nowrap">
          {importing ? 'インポート中...' : 'CSV読込'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleCsvImport} />
      </div>

      {importResult && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${importResult.startsWith('エラー') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {importResult}
        </div>
      )}

      <div className="mb-2 text-xs text-gray-400">
        CSV形式：品番,品名,仕様,単位,単価,メーカー（1行目はヘッダー行）
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">読み込み中...</div>
      ) : displayed.length === 0 ? (
        <div className="text-sm text-gray-500 py-8 text-center">商品がありません</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-2 font-medium text-gray-500">品番</th>
                <th className="text-left py-2 px-2 font-medium text-gray-500">品名</th>
                <th className="text-left py-2 px-2 font-medium text-gray-500">仕様</th>
                <th className="text-left py-2 px-2 font-medium text-gray-500">単位</th>
                <th className="text-right py-2 px-2 font-medium text-gray-500">単価</th>
                <th className="text-left py-2 px-2 font-medium text-gray-500">メーカー</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2 font-mono text-gray-700">{p.code}</td>
                  <td className="py-2 px-2 text-gray-900">{p.name}</td>
                  <td className="py-2 px-2 text-gray-500">{p.spec}</td>
                  <td className="py-2 px-2 text-gray-500">{p.unit}</td>
                  <td className="py-2 px-2 text-right text-gray-900">¥{p.unit_price.toLocaleString()}</td>
                  <td className="py-2 px-2 text-gray-400">{p.maker}</td>
                  <td className="py-2 px-2 flex gap-1 justify-end">
                    <button onClick={() => setEditProduct(p)} className="text-blue-500 hover:text-blue-700 px-1">編集</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 px-1">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-xs text-gray-400">{displayed.length}件</div>
        </div>
      )}

      {(showAdd || editProduct) && (
        <ProductModal
          product={editProduct}
          onClose={() => { setShowAdd(false); setEditProduct(null) }}
          onSaved={fetchProducts}
        />
      )}
    </div>
  )
}

function ProductModal({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState(product?.code ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [spec, setSpec] = useState(product?.spec ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '台')
  const [unitPrice, setUnitPrice] = useState(String(product?.unit_price ?? ''))
  const [maker, setMaker] = useState(product?.maker ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!code || !name) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const payload = { code, name, spec, unit, unit_price: Number(unitPrice) || 0, maker }
      if (product) {
        await supabase.from('products').update(payload).eq('id', product.id)
      } else {
        await supabase.from('products').insert(payload)
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 mb-4">{product ? '商品を編集' : '商品を追加'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">品番 *</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">品名 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">仕様</label>
            <input type="text" value={spec} onChange={e => setSpec(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">単位</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">単価（円）</label>
              <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メーカー</label>
            <input type="text" value={maker} onChange={e => setMaker(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
          <button onClick={handleSave} disabled={saving || !code || !name}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
