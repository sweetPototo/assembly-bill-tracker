import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

interface StatRow { status: string; count: number }

async function fetchStats(): Promise<{ total: number; active: number; passed: number; rejected: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('bills')
    .select('status')

  const rows = (data ?? []) as { status: string | null }[]
  const total    = rows.length
  const active   = rows.filter(r => r.status === '진행중').length
  const passed   = rows.filter(r => r.status === '가결' || r.status === '공포').length
  const rejected = rows.filter(r => r.status === '부결' || r.status === '철회' || r.status === '폐기').length
  return { total, active, passed, rejected }
}

async function fetchRecent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('bills')
    .select('bill_id, bill_name, committee, propose_dt, status, ai_reason')
    .order('propose_dt', { ascending: false, nullsFirst: false })
    .order('bill_id',    { ascending: false })
    .limit(5)
  return data ?? []
}

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-50 text-blue-600 border border-blue-200',
  '가결':   'bg-green-50 text-green-600 border border-green-200',
  '부결':   'bg-red-50 text-red-600 border border-red-200',
  '공포':   'bg-violet-50 text-violet-600 border border-violet-200',
  '철회':   'bg-slate-100 text-slate-500 border border-slate-200',
  '폐기':   'bg-slate-100 text-slate-500 border border-slate-200',
}

export default async function BillsHomePage() {
  const [stats, recent] = await Promise.all([fetchStats(), fetchRecent()])

  return (
    <main className="max-w-3xl mx-auto px-4 pt-[112px] pb-16">

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">국회 발의안</h1>
        <p className="text-sm text-slate-500 mt-1">22대 국회에 발의된 법률안을 한눈에 확인하세요.</p>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-10">
        {[
          { label: '전체',   value: stats.total,    color: 'text-slate-700' },
          { label: '진행중', value: stats.active,   color: 'text-blue-600'  },
          { label: '가결',   value: stats.passed,   color: 'text-green-600' },
          { label: '부결·종료', value: stats.rejected, color: 'text-slate-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* 최근 발의안 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-700">최근 발의안</h2>
        <Link href="/bills/all" className="text-xs text-blue-500 hover:underline">전체 보기</Link>
      </div>

      <div className="flex flex-col divide-y divide-slate-100 mb-8">
        {recent.map((bill: any) => (
          <div key={bill.bill_id} className="py-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLE[bill.status ?? ''] ?? 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                {bill.status ?? '—'}
              </span>
              {bill.committee && (
                <span className="text-xs text-slate-400 truncate">{bill.committee}</span>
              )}
              <span className="text-xs text-slate-300 ml-auto flex-shrink-0">{bill.propose_dt ?? ''}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">
              {bill.bill_name}
            </p>
            {bill.ai_reason && (
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{bill.ai_reason}</p>
            )}
          </div>
        ))}
      </div>

      {/* 빠른 이동 */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/bills/active" className="rounded-xl border border-blue-100 bg-blue-50 p-4 hover:bg-blue-100 transition-colors">
          <p className="text-sm font-bold text-blue-700">진행중인 법</p>
          <p className="text-xs text-blue-500 mt-1">심의가 진행 중인 법률안</p>
        </Link>
        <Link href="/bills/closed" className="rounded-xl border border-slate-100 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
          <p className="text-sm font-bold text-slate-700">종료된 법</p>
          <p className="text-xs text-slate-500 mt-1">가결·부결·공포된 법률안</p>
        </Link>
      </div>

    </main>
  )
}
