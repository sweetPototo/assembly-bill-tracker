'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

type Stats = { total: number; active: number; passed: number; rejected: number }

function getMonthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDay = `${year}-${pad(month)}-01`
  const lastDay  = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
  return { firstDay, lastDay }
}

async function fetchMonthStats(year: number, month: number): Promise<Stats> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { firstDay, lastDay } = getMonthRange(year, month)

  const base = () => supabase.from('bills').select('*', { count: 'exact', head: true })
  const inMonthOr = (...cols: string[]) =>
    cols.map(c => `and(${c}.gte.${firstDay},${c}.lte.${lastDay})`).join(',')

  const [
    { count: active },
    { count: passed },
    { count: rejected },
  ] = await Promise.all([
    base().eq('status', '진행중').gte('propose_dt', firstDay).lte('propose_dt', lastDay),
    base().in('status', ['가결', '공포']).or(inMonthOr('rgs_rsln_dt', 'prom_dt')),
    base().in('status', ['부결', '철회', '폐기']).or(inMonthOr('rgs_rsln_dt', 'jrcmit_proc_dt')),
  ])

  const a = active ?? 0, p = passed ?? 0, r = rejected ?? 0
  return { total: a + p + r, active: a, passed: p, rejected: r }
}

export default function MonthlyStats({ initial }: { initial: Stats }) {
  const [curYear]  = useState(() => new Date().getFullYear())
  const [curMonth] = useState(() => new Date().getMonth() + 1)

  const [year,    setYear]    = useState(curYear)
  const [month,   setMonth]   = useState(curMonth)
  const [stats,   setStats]   = useState<Stats>(initial)
  const [loading, setLoading] = useState(false)

  const skipFirst = useRef(true)

  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    setLoading(true)
    fetchMonthStats(year, month).then(s => { setStats(s); setLoading(false) })
  }, [year, month])

  const isCurrent = year === curYear && month === curMonth
  const { firstDay, lastDay } = getMonthRange(year, month)

  const prev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  const next = () => {
    if (isCurrent) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 active:bg-slate-200 text-lg leading-none"
          >‹</button>
          <h2 className="text-sm font-bold text-slate-600 px-1">{month}월의 발의 현황</h2>
          <button
            onClick={next}
            disabled={isCurrent}
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 active:bg-slate-200 text-lg leading-none disabled:opacity-25 disabled:pointer-events-none"
          >›</button>
        </div>
        <span className="text-xs text-slate-400">{year}년</span>
      </div>

      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 transition-opacity ${loading ? 'opacity-40' : ''}`}>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{stats.total.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">전체</p>
        </div>
        <Link
          href={`/bills/active?dateField=propose_dt&dateFrom=${firstDay}&dateTo=${lastDay}`}
          className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center hover:bg-blue-100 active:bg-blue-200 transition-colors"
        >
          <p className="text-2xl font-bold text-blue-600">{stats.active.toLocaleString()}</p>
          <p className="text-xs text-blue-500 mt-1">진행중</p>
        </Link>
        <Link
          href={`/bills/closed?statusFilter=passed&dateField=rgs_rsln_dt&dateFrom=${firstDay}&dateTo=${lastDay}`}
          className="rounded-xl border border-green-100 bg-green-50 p-4 text-center hover:bg-green-100 active:bg-green-200 transition-colors"
        >
          <p className="text-2xl font-bold text-green-600">{stats.passed.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">가결</p>
        </Link>
        <Link
          href={`/bills/closed?statusFilter=rejected&dateField=rgs_rsln_dt&dateFrom=${firstDay}&dateTo=${lastDay}`}
          className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <p className="text-2xl font-bold text-slate-500">{stats.rejected.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">부결·종료</p>
        </Link>
      </div>
    </>
  )
}
