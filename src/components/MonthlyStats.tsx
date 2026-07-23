import Link from 'next/link'
import type { PeriodStats } from '@/lib/supabase'

function fmtLabel(s: string) {
  const [, m, d] = s.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

export default function MonthlyStats({ initial }: { initial: { current: PeriodStats; start: string; end: string } }) {
  const { current, start, end } = initial

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-600">이번 달 발의 현황</h2>
        <span className="text-xs text-slate-400">
          {fmtLabel(start)} ~ {fmtLabel(end)}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{current.total.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">전체</p>
        </div>

        <Link
          href={`/bills/active?dateField=propose_dt&dateFrom=${start}&dateTo=${end}`}
          className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center hover:bg-blue-100 active:bg-blue-200 transition-colors"
        >
          <p className="text-2xl font-bold text-blue-600">{current.active.toLocaleString()}</p>
          <p className="text-xs text-blue-500 mt-1">진행중</p>
        </Link>

        <Link
          href={`/bills/closed?statusFilter=passed&dateField=rgs_rsln_dt&dateFrom=${start}&dateTo=${end}`}
          className="rounded-xl border border-green-100 bg-green-50 p-4 text-center hover:bg-green-100 active:bg-green-200 transition-colors"
        >
          <p className="text-2xl font-bold text-green-600">{current.passed.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">가결</p>
        </Link>

        <Link
          href={`/bills/closed?statusFilter=rejected&dateField=rgs_rsln_dt&dateFrom=${start}&dateTo=${end}`}
          className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <p className="text-2xl font-bold text-slate-500">{current.rejected.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">부결·종료</p>
        </Link>
      </div>
    </>
  )
}
