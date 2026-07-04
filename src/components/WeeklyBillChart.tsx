import Link from 'next/link'

export type WeeklyStat = { category: string; count: number; delta: number }

export default function WeeklyBillChart({
  rows,
  hasLastWeek,
  dateFrom,
  dateTo,
}: {
  rows: WeeklyStat[]
  hasLastWeek: boolean
  dateFrom: string
  dateTo: string
}) {
  if (!rows.length) {
    return <p className="text-xs text-slate-400 text-center py-6">데이터가 없습니다.</p>
  }

  const maxCount = Math.max(...rows.map(r => r.count), 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-slate-600">카테고리별 발의 현황</h2>
        <span className="text-xs text-slate-400">최근 7일</span>
      </div>
      <p className="text-xs text-slate-400 mb-3">※AI가 분류한 카테고리 기준의 통계입니다.</p>

      <style>{`
        .bill-bar { background: #2a78d6; }
        @media (prefers-color-scheme: dark) { .bill-bar { background: #3987e5; } }
      `}</style>

      <div className="space-y-2.5">
        {rows.map(row => {
          const pct = (row.count / maxCount) * 100
          const deltaPositive = row.delta > 0
          const deltaNegative = row.delta < 0

          const href = `/bills/all?dateField=propose_dt&dateFrom=${dateFrom}&dateTo=${dateTo}&category=${encodeURIComponent(row.category)}`

          return (
            <Link
              key={row.category}
              href={href}
              className="flex items-center gap-2 -mx-1 px-1 py-0.5 rounded hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              {/* 카테고리명 */}
              <div
                className="w-16 text-xs text-slate-500 text-right flex-shrink-0 truncate"
                title={row.category}
              >
                {row.category}
              </div>

              {/* 바 트랙 */}
              <div className="flex-1 h-3 bg-slate-100 rounded-sm relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bill-bar"
                  style={{
                    width: `${pct}%`,
                    borderRadius: '0 4px 4px 0',
                  }}
                  title={`${row.category}: ${row.count.toLocaleString()}건`}
                />
              </div>

              {/* 건수 */}
              <div className="w-8 text-xs text-right tabular-nums text-slate-700 flex-shrink-0">
                {row.count.toLocaleString()}
              </div>

              {/* 증감 (지난주 데이터가 있을 때만 표시) */}
              {hasLastWeek && (
                <div
                  className="w-10 text-xs text-right tabular-nums flex-shrink-0"
                  style={{
                    color: deltaPositive ? '#006300'
                         : deltaNegative ? '#d03b3b'
                         : '#898781',
                  }}
                >
                  {deltaPositive ? `▲${row.delta}`
                   : deltaNegative ? `▼${Math.abs(row.delta)}`
                   : '—'}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      <p className="text-xs mt-3 text-right" style={{ color: '#898781' }}>
        이전 7일 대비 증감 →
      </p>
    </div>
  )
}
