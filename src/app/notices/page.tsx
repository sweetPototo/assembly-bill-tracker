'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchNotices, NOTICE_PAGE_SIZE, type Notice } from '@/lib/supabase'

export default function NoticesPage() {
  const [notices, setNotices]   = useState<Notice[]>([])
  const [offset, setOffset]     = useState(0)
  const [hasMore, setHasMore]   = useState(true)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const load = useCallback(async (from: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNotices(from)
      setNotices(prev => from === 0 ? data : [...prev, ...data])
      setOffset(from + data.length)
      setHasMore(data.length === NOTICE_PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 pt-[116px] pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">공지사항</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          조회 오류: {error}
        </div>
      )}

      <div className="flex flex-col divide-y divide-slate-100">
        {notices.map(notice => {
          const isOpen = expanded.has(notice.id)
          return (
            <button
              key={notice.id}
              onClick={() => toggleExpand(notice.id)}
              className="py-4 text-left w-full active:bg-slate-50 rounded-lg transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {notice.title}
                  </p>
                  {isOpen && (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">
                      {notice.content}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end flex-shrink-0 gap-1">
                  <span className="text-xs text-slate-300">
                    {notice.created_at.slice(0, 10)}
                  </span>
                  <span className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {loading && (
        <p className="text-center text-sm text-slate-400 mt-6">불러오는 중...</p>
      )}

      {!loading && !error && hasMore && notices.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => load(offset)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-blue-600 border border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            더보기
          </button>
        </div>
      )}

      {!loading && !hasMore && notices.length > 0 && (
        <p className="text-center text-xs text-slate-400 mt-6">모든 공지사항을 불러왔습니다.</p>
      )}

      {!loading && !error && notices.length === 0 && (
        <p className="text-center text-sm text-slate-400 mt-10">등록된 공지사항이 없습니다.</p>
      )}
    </main>
  )
}
