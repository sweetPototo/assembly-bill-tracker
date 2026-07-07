import Link from 'next/link'
import type { ComparisonStats } from '@/lib/supabase'

function fmtLabel(s: string) {
  const [, m, d] = s.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev
  if (diff > 0) return <span className="text-xs font-medium text-green-500">+{diff}</span>
  if (diff < 0) return <span className="text-xs font-medium text-red-400">{diff}</span>
  return <span className="text-xs text-slate-300">±0</span>
}

export default function MonthlyStats({ initial }: { initial: ComparisonStats }) {
  const { current, previous, currentStart, currentEnd } = initial

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-600">최근 7일 발의 현황</h2>
        <span className="text-xs text-slate-400">
          {fmtLabel(currentStart)} ~ {fmtLabel(currentEnd)} · 전주 대비
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{current.total.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Delta now={current.total} prev={previous.total} />
            <p className="text-xs text-slate-500">전체</p>
          </div>
        </div>

        <Link
          href={`/bills/active?dateField=propose_dt&dateFrom=${currentStart}&dateTo=${currentEnd}`}
          className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center hover:bg-blue-100 active:bg-blue-200 transition-colors"
        >
          <p className="text-2xl font-bold text-blue-600">{current.active.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Delta now={current.active} prev={previous.active} />
            <p className="text-xs text-blue-500">진행중</p>
          </div>
        </Link>

        <Link
          href={`/bills/closed?statusFilter=passed&dateField=rgs_rsln_dt&dateFrom=${currentStart}&dateTo=${currentEnd}`}
          className="rounded-xl border border-green-100 bg-green-50 p-4 text-center hover:bg-green-100 active:bg-green-200 transition-colors"
        >
          <p className="text-2xl font-bold text-green-600">{current.passed.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Delta now={current.passed} prev={previous.passed} />
            <p className="text-xs text-green-600">가결</p>
          </div>
        </Link>

        <Link
          href={`/bills/closed?statusFilter=rejected&dateField=rgs_rsln_dt&dateFrom=${currentStart}&dateTo=${currentEnd}`}
          className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <p className="text-2xl font-bold text-slate-500">{current.rejected.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <Delta now={current.rejected} prev={previous.rejected} />
            <p className="text-xs text-slate-500">부결·종료</p>
          </div>
        </Link>
      </div>
    </>
  )
}
