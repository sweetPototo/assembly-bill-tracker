import Link from 'next/link'

type Stats = { total: number; active: number; passed: number; rejected: number }

function getMonthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDay = `${year}-${pad(month)}-01`
  const lastDay  = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
  return { firstDay, lastDay }
}

export default function MonthlyStats({ initial }: { initial: Stats }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1
  const stats = initial

  const { firstDay, lastDay } = getMonthRange(year, month)

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-600">{month}월의 발의 현황</h2>
        <span className="text-xs text-slate-400">{year}년</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
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
