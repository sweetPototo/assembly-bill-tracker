'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchBills, BILL_PAGE_SIZE, type Bill } from '@/lib/supabase'

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-50 text-blue-600 border border-blue-200',
  '가결':   'bg-green-50 text-green-600 border border-green-200',
  '부결':   'bg-red-50 text-red-600 border border-red-200',
  '공포':   'bg-violet-50 text-violet-600 border border-violet-200',
  '철회':   'bg-slate-100 text-slate-500 border border-slate-200',
  '폐기':   'bg-slate-100 text-slate-500 border border-slate-200',
}

export default function BillsAllPage() {
  const [bills, setBills]     = useState<Bill[]>([])
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async (from: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBills(from)
      setBills(prev => {
        if (from === 0) return data
        const existingIds = new Set(prev.map(b => b.bill_id))
        return [...prev, ...data.filter(b => !existingIds.has(b.bill_id))]
      })
      setOffset(from + data.length)
      setHasMore(data.length === BILL_PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  return (
    <main className="max-w-3xl mx-auto px-4 pt-[112px] pb-16">
      <h1 className="text-xl font-bold text-slate-800 mb-4">전체 발의안</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          조회 오류: {error}
        </div>
      )}

      <div className="flex flex-col divide-y divide-slate-100">
        {bills.map((bill) => (
          <div key={bill.bill_id} className="py-4 flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[bill.status ?? ''] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              {bill.status ?? '—'}
            </span>
            <p className="flex-1 text-sm font-medium text-slate-800 leading-snug min-w-0 truncate">
              {bill.bill_name}
            </p>
            <p className="text-xs text-slate-400 flex-shrink-0">
              {bill.propose_dt ?? '—'}
            </p>
          </div>
        ))}
      </div>

      {loading && (
        <p className="text-center text-sm text-slate-400 mt-6">불러오는 중...</p>
      )}

      {!loading && !error && hasMore && bills.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => load(offset)}
            className="px-6 py-2 rounded-full text-sm font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50 transition-colors"
          >
            더보기
          </button>
        </div>
      )}

      {!loading && !hasMore && bills.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6">모든 발의안을 불러왔습니다.</p>
      )}
    </main>
  )
}
