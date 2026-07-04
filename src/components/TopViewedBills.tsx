import Link from 'next/link'

export type TopViewedBill = {
  bill_id: string
  bill_name: string
  category: string | null
  view_count: number
}

const RANK_STYLE = [
  'bg-amber-100 text-amber-700',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-700',
]

export default function TopViewedBills({ bills }: { bills: TopViewedBill[] }) {
  if (!bills.length) {
    return <p className="text-xs text-slate-400 text-center py-6">데이터가 없습니다.</p>
  }

  return (
    <div>
      <h2 className="text-sm font-bold text-slate-600 mb-3">조회수 TOP3 발의안</h2>

      <div className="flex flex-col divide-y divide-slate-100">
        {bills.map((bill, i) => (
          <Link
            key={bill.bill_id}
            href={`/bills/${bill.bill_id}`}
            className="py-3 flex items-center gap-3 active:bg-slate-50 rounded-lg transition-colors"
          >
            <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${RANK_STYLE[i] ?? 'bg-slate-100 text-slate-500'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {bill.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                    {bill.category}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 leading-snug truncate">
                {bill.bill_name}
              </p>
            </div>
            <span className="text-xs text-slate-400 flex-shrink-0">조회 {bill.view_count.toLocaleString()}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
