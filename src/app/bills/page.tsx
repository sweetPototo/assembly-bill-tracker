import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
import { fetchAssemblySeats } from '@/lib/supabase'
import AssemblySeatChart from '@/components/AssemblySeatChart'
import MonthlyStats from '@/components/MonthlyStats'
import WeeklyBillChart, { type WeeklyStat } from '@/components/WeeklyBillChart'
import TopViewedBills, { type TopViewedBill } from '@/components/TopViewedBills'


async function fetchStats(): Promise<{ total: number; active: number; passed: number; rejected: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now        = new Date()
  const pad        = (n: number) => String(n).padStart(2, '0')
  const firstDay   = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const lastDayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`

  const base = () => supabase.from('bills').select('*', { count: 'exact', head: true })
  const inMonthOr = (...cols: string[]) =>
    cols.map(c => `and(${c}.gte.${firstDay},${c}.lte.${lastDayStr})`).join(',')

  const [
    { count: active },
    { count: passed },
    { count: rejected },
  ] = await Promise.all([
    base()
      .eq('status', '진행중')
      .gte('propose_dt', firstDay)
      .lte('propose_dt', lastDayStr),
    base()
      .in('status', ['가결', '공포'])
      .or(inMonthOr('rgs_rsln_dt', 'prom_dt')),
    base()
      .in('status', ['부결', '철회', '폐기'])
      .or(inMonthOr('rgs_rsln_dt', 'jrcmit_proc_dt')),
  ])

  return { total: (active ?? 0) + (passed ?? 0) + (rejected ?? 0), active: active ?? 0, passed: passed ?? 0, rejected: rejected ?? 0 }
}

function getPeriodStarts(): { recentStart: string; recentEnd: string; prevStart: string } {
  const today = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const addDays = (d: Date, n: number) => {
    const r = new Date(d); r.setDate(d.getDate() + n); return r
  }
  // 오늘(집계 미완료 가능성)은 제외하고,
  // 최근 구간: 1~7일 전, 이전 구간: 8~14일 전
  return {
    recentStart: fmt(addDays(today, -7)),
    recentEnd: fmt(addDays(today, -1)),
    prevStart: fmt(addDays(today, -14)),
  }
}

async function fetchWeeklyStats(): Promise<{ rows: WeeklyStat[]; hasLastWeek: boolean }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { recentStart, recentEnd, prevStart } = getPeriodStarts()
  const { data, error } = await supabase
    .from('bills_weekly_statistics')
    .select('date, category, bill_count')
    .gte('date', prevStart)
    .lte('date', recentEnd)

  if (error) console.error('[WeeklyStats]', error.message)

  type Row = { date: string; category: string; bill_count: number }
  const rows = (data ?? []) as Row[]
  const thisMap = new Map<string, number>()
  const lastMap = new Map<string, number>()
  for (const r of rows) {
    const map = r.date >= recentStart ? thisMap : lastMap
    map.set(r.category, (map.get(r.category) ?? 0) + r.bill_count)
  }

  const hasLastWeek = lastMap.size > 0

  const result: WeeklyStat[] = Array.from(thisMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      delta: hasLastWeek ? count - (lastMap.get(category) ?? 0) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return { rows: result, hasLastWeek }
}

async function fetchTopViewed(): Promise<TopViewedBill[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data, error } = await supabase
    .from('bills')
    .select('bill_id, bill_name, category, view_count')
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(3)

  if (error) console.error('[TopViewed]', error.message)
  return (data ?? []) as TopViewedBill[]
}

async function fetchRecent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('bills')
    .select('bill_id, bill_name, committee, propose_dt, status, category, ai_reason')
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
  const [stats, recent, seats, weekly, topViewed] = await Promise.all([fetchStats(), fetchRecent(), fetchAssemblySeats(), fetchWeeklyStats(), fetchTopViewed()])
  const { recentStart, recentEnd } = getPeriodStarts()

  return (
    <main className="max-w-3xl mx-auto px-4 pt-[116px] pb-16">

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">국회 발의안</h1>
        <p className="text-sm text-slate-500 mt-1">22대 국회에 발의된 법률안을 한눈에 확인하세요.</p>
      </div>

      {/* 현황 카드 — 모바일 2열, 태블릿 이상 4열 */}
      <MonthlyStats initial={stats} />

      {/* 조회수 TOP3 발의안 */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 mb-8">
        <TopViewedBills bills={topViewed} />
      </div>

      {/* 카테고리별 주간 발의 현황 */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 mb-8">
        <WeeklyBillChart rows={weekly.rows} hasLastWeek={weekly.hasLastWeek} dateFrom={recentStart} dateTo={recentEnd} />
      </div>

      {/* 최근 발의안 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-700">최근 발의안</h2>
        <Link href="/bills/all" className="text-sm text-blue-500 px-2 py-1 rounded hover:bg-blue-50 active:bg-blue-100 transition-colors">전체 보기</Link>
      </div>

      <div className="flex flex-col divide-y divide-slate-100 mb-8">
        {recent.map((bill: any) => (
          <Link
            key={bill.bill_id}
            href={`/bills/${bill.bill_id}`}
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
              <span className="text-xs text-slate-300 ml-auto flex-shrink-0">{bill.propose_dt ?? ''}</span>
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

      {/* 의석 현황 */}
      <div style={{ maxWidth: 1080 }} className="mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-600">22대 국회 의석 현황</h2>
          <span className="text-xs text-slate-400">총 299석</span>
        </div>
        <AssemblySeatChart seats={seats} />
      </div>

    </main>
  )
}
