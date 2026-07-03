'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchBills, BILL_PAGE_SIZE, type Bill, type BillFilter } from '@/lib/supabase'

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-50 text-blue-600 border border-blue-200',
  '가결':   'bg-green-50 text-green-600 border border-green-200',
  '부결':   'bg-red-50 text-red-600 border border-red-200',
  '공포':   'bg-violet-50 text-violet-600 border border-violet-200',
  '철회':   'bg-slate-100 text-slate-500 border border-slate-200',
  '폐기':   'bg-slate-100 text-slate-500 border border-slate-200',
}

interface Props {
  filter?: BillFilter
}

export default function BillList({ filter = 'all' }: Props) {
  const [keyword,  setKeyword]  = useState('')
  const [proposer, setProposer] = useState('')
  const [debouncedKeyword,  setDebouncedKeyword]  = useState('')
  const [debouncedProposer, setDebouncedProposer] = useState('')

  const [bills, setBills]     = useState<Bill[]>([])
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // 300ms 디바운스
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(t)
  }, [keyword])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedProposer(proposer), 300)
    return () => clearTimeout(t)
  }, [proposer])

  const load = useCallback(async (from: number, kw: string, pr: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBills(from, filter, { keyword: kw, proposer: pr })
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
  }, [filter])

  // 검색어 변경 시 처음부터 다시 로드
  useEffect(() => {
    setBills([])
    setOffset(0)
    setHasMore(true)
    load(0, debouncedKeyword, debouncedProposer)
  }, [debouncedKeyword, debouncedProposer, filter, load])

  return (
    <>
      {/* 검색 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            type="search"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="법안명 · 내용 검색"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
        </div>
        <div className="relative sm:w-40">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">👤</span>
          <input
            type="search"
            value={proposer}
            onChange={e => setProposer(e.target.value)}
            placeholder="발의 의원"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          조회 오류: {error}
        </div>
      )}

      <div className="flex flex-col divide-y divide-slate-100">
        {bills.map((bill) => (
          <Link
            key={bill.bill_id}
            href={`/bills/${bill.bill_id}`}
            className="py-4 block active:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[bill.status ?? ''] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                {bill.status ?? '—'}
              </span>
              {bill.committee && (
                <span className="text-xs text-slate-400">{bill.committee}</span>
              )}
              <div className="ml-auto flex-shrink-0 text-right">
                <p className="text-xs text-slate-300">{bill.propose_dt ?? '—'}</p>
                <p className="text-xs text-slate-300">조회 {bill.view_count.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">
              {bill.bill_name}
            </p>
            {bill.ai_reason && (
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{bill.ai_reason}</p>
            )}
          </Link>
        ))}
      </div>

      {loading && (
        <p className="text-center text-sm text-slate-400 mt-6">불러오는 중...</p>
      )}

      {!loading && !error && hasMore && bills.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => load(offset, debouncedKeyword, debouncedProposer)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            더보기
          </button>
        </div>
      )}

      {!loading && !hasMore && bills.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6">모든 발의안을 불러왔습니다.</p>
      )}

      {!loading && !error && bills.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-10">
          {debouncedKeyword || debouncedProposer ? '검색 결과가 없습니다.' : '해당하는 발의안이 없습니다.'}
        </p>
      )}
    </>
  )
}
