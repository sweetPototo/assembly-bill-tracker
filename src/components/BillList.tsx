'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { fetchBills, BILL_PAGE_SIZE, BILL_CATEGORIES, type Bill, type BillFilter } from '@/lib/supabase'

interface SavedState {
  bills:     Bill[]
  offset:    number
  keyword:   string
  proposer:  string
  dateField: 'propose_dt' | 'rgs_rsln_dt'
  dateFrom:  string
  dateTo:    string
  category:  string[]
  hasMore:   boolean
  scrollY:   number
}

function readSavedState(filter: BillFilter): SavedState | null {
  // useEffect 안에서만 호출 — window 가드 불필요
  if (sessionStorage.getItem('billList_navigate_back') !== '1') return null
  sessionStorage.removeItem('billList_navigate_back')
  try {
    const raw = sessionStorage.getItem(`billList_${filter}`)
    if (!raw) return null
    sessionStorage.removeItem(`billList_${filter}`)
    return JSON.parse(raw) as SavedState
  } catch {
    return null
  }
}

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-50 text-blue-600 border border-blue-200',
  '가결':   'bg-green-50 text-green-600 border border-green-200',
  '부결':   'bg-red-50 text-red-600 border border-red-200',
  '공포':   'bg-violet-50 text-violet-600 border border-violet-200',
  '철회':   'bg-slate-100 text-slate-500 border border-slate-200',
  '폐기':   'bg-slate-100 text-slate-500 border border-slate-200',
}

interface Props {
  filter?:        BillFilter
  initialSearch?: Record<string, string>
}

export default function BillList({ filter = 'all', initialSearch }: Props) {
  const [keyword,  setKeyword]  = useState('')
  const [proposer, setProposer] = useState('')
  const [debouncedKeyword,  setDebouncedKeyword]  = useState('')
  const [debouncedProposer, setDebouncedProposer] = useState('')
  const [dateField, setDateField] = useState<'propose_dt' | 'rgs_rsln_dt'>(
    initialSearch?.dateField === 'rgs_rsln_dt' ? 'rgs_rsln_dt' : 'propose_dt'
  )
  const [dateFrom, setDateFrom] = useState(initialSearch?.dateFrom ?? '')
  const [dateTo,   setDateTo]   = useState(initialSearch?.dateTo   ?? '')
  const [categories, setCategories] = useState<string[]>(
    initialSearch?.category ? initialSearch.category.split(',').filter(Boolean) : []
  )

  // 검색 버튼을 눌렀을 때만 실제 쿼리에 반영되는 committed 값
  const [committedDateField, setCommittedDateField] = useState<'propose_dt' | 'rgs_rsln_dt'>(
    initialSearch?.dateField === 'rgs_rsln_dt' ? 'rgs_rsln_dt' : 'propose_dt'
  )
  const [committedDateFrom, setCommittedDateFrom] = useState(initialSearch?.dateFrom ?? '')
  const [committedDateTo,   setCommittedDateTo]   = useState(initialSearch?.dateTo   ?? '')
  const [committedCategories, setCommittedCategories] = useState<string[]>(
    initialSearch?.category ? initialSearch.category.split(',').filter(Boolean) : []
  )
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!categoryOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [categoryOpen])

  const toggleCategory = useCallback((c: string) => {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }, [])

  const statusFilter: 'passed' | 'rejected' | undefined =
    initialSearch?.statusFilter === 'passed'   ? 'passed'   :
    initialSearch?.statusFilter === 'rejected' ? 'rejected' : undefined

  const [bills, setBills]           = useState<Bill[]>([])
  const [offset, setOffset]         = useState(0)
  const [loading, setLoading]       = useState(false)
  const [hasMore, setHasMore]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [popularSearches, setPopularSearches] = useState<string[]>([])

  // true일 때 load effect를 한 번 스킵 (복원 시 세팅)
  const isRestoringRef = useRef(false)

  const commitSearch = useCallback(() => {
    setDebouncedKeyword(keyword)
    setDebouncedProposer(proposer)
    setCommittedDateField(dateField)
    setCommittedDateFrom(dateFrom)
    setCommittedDateTo(dateTo)
    setCommittedCategories(categories)
  }, [keyword, proposer, dateField, dateFrom, dateTo, categories])

  // 인기 검색어 초기 로드
  useEffect(() => {
    fetch('/api/popular-searches')
      .then(r => r.ok ? r.json() : [])
      .then((data: { term: string }[]) => setPopularSearches(data.map(d => d.term)))
      .catch(() => {})
  }, [])

  // 검색어 로깅 — fire-and-forget, 결과와 무관하게 조용히 처리
  useEffect(() => {
    const trimmed = debouncedKeyword.trim()
    if (trimmed.length < 2) return
    fetch('/api/search-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: trimmed }),
    }).catch(() => {})
  }, [debouncedKeyword])

  const load = useCallback(async (
    from: number, kw: string, pr: string,
    df: 'propose_dt' | 'rgs_rsln_dt', dFrom: string, dTo: string, cat: string[],
  ) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBills(from, filter, { keyword: kw, proposer: pr, dateField: df, dateFrom: dFrom, dateTo: dTo, statusFilter, category: cat })
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
  }, [filter, statusFilter])

  // 뒤로가기 복원 — useEffect 안에서만 sessionStorage 접근 (SSR에서는 실행 안 됨)
  // 반드시 load effect보다 먼저 선언해야 React가 먼저 실행함
  useEffect(() => {
    const saved = readSavedState(filter)
    if (!saved) return
    isRestoringRef.current = true
    setBills(saved.bills)
    setOffset(saved.offset)
    setKeyword(saved.keyword)
    setProposer(saved.proposer)
    setDateField(saved.dateField);       setCommittedDateField(saved.dateField)
    setDateFrom(saved.dateFrom);         setCommittedDateFrom(saved.dateFrom)
    setDateTo(saved.dateTo);             setCommittedDateTo(saved.dateTo)
    setCategories(saved.category);       setCommittedCategories(saved.category)
    setHasMore(saved.hasMore)
    setDebouncedKeyword(saved.keyword)
    setDebouncedProposer(saved.proposer)
    requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY, behavior: 'instant' }))
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  // 검색어 변경 시 처음부터 다시 로드 (복원 직후엔 스킵)
  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false
      return
    }
    setBills([])
    setOffset(0)
    setHasMore(true)
    load(0, debouncedKeyword, debouncedProposer, committedDateField, committedDateFrom, committedDateTo, committedCategories)
  }, [debouncedKeyword, debouncedProposer, committedDateField, committedDateFrom, committedDateTo, committedCategories, filter, load])

  const resetSearch = useCallback(() => {
    setKeyword('');    setDebouncedKeyword('')
    setProposer('');   setDebouncedProposer('')
    setDateField('propose_dt'); setCommittedDateField('propose_dt')
    setDateFrom('');   setCommittedDateFrom('')
    setDateTo('');     setCommittedDateTo('')
    setCategories([]); setCommittedCategories([])
  }, [])

  const saveState = useCallback(() => {
    sessionStorage.setItem(`billList_${filter}`, JSON.stringify({
      bills,
      offset,
      keyword,
      proposer,
      dateField,
      dateFrom,
      dateTo,
      category: categories,
      hasMore,
      scrollY: window.scrollY,
    } satisfies SavedState))
  }, [bills, offset, keyword, proposer, dateField, dateFrom, dateTo, categories, hasMore, filter])

  return (
    <>
      {/* 날짜 검색 + 초기화 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden flex-shrink-0">
          {(['propose_dt', 'rgs_rsln_dt'] as const).map(field => (
            <button
              key={field}
              onClick={() => setDateField(field)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                dateField === field
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {field === 'propose_dt' ? '제안일' : '종료일'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
          <span className="text-slate-400 text-sm flex-shrink-0">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
        </div>
        <button
          onClick={resetSearch}
          className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          초기화
        </button>
      </div>

      {/* 검색 */}
      <div className={`flex flex-col sm:flex-row gap-2 ${popularSearches.length > 0 ? 'mb-3' : 'mb-5'}`}>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            type="search"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commitSearch()}
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
            onKeyDown={e => e.key === 'Enter' && commitSearch()}
            placeholder="발의 의원"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
        </div>
        <div ref={categoryRef} className="relative sm:w-40 flex-shrink-0">
          <button
            type="button"
            onClick={() => setCategoryOpen(o => !o)}
            className={`w-full flex items-center justify-between gap-1 px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${
              categories.length > 0
                ? 'border-blue-300 bg-blue-50 text-blue-600'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <span className="truncate">{categories.length > 0 ? `카테고리 ${categories.length}` : '카테고리'}</span>
            <span className="text-xs flex-shrink-0">▾</span>
          </button>
          {categoryOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1">
              {BILL_CATEGORIES.map(c => (
                <label
                  key={c}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(c)}
                    onChange={() => toggleCategory(c)}
                    className="rounded border-slate-300 text-blue-500 focus:ring-blue-300"
                  />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={commitSearch}
          className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors"
        >
          검색
        </button>
      </div>

      {/* 인기 검색어 */}
      {popularSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <span className="text-xs text-slate-400 flex-shrink-0">인기</span>
          {popularSearches.map(term => (
            <button
              key={term}
              onClick={() => { setKeyword(term); setDebouncedKeyword(term) }}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      )}

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
            onClick={saveState}
            className="py-4 block active:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[bill.status ?? ''] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                {bill.status ?? '—'}
              </span>
              {bill.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                  {bill.category}
                </span>
              )}
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
            onClick={() => load(offset, debouncedKeyword, debouncedProposer, committedDateField, committedDateFrom, committedDateTo, committedCategories)}
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
          {debouncedKeyword || debouncedProposer || committedDateFrom || committedDateTo || committedCategories.length > 0 ? '검색 결과가 없습니다.' : '해당하는 발의안이 없습니다.'}
        </p>
      )}
    </>
  )
}
