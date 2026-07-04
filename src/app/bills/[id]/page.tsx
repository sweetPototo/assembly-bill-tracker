import { notFound } from 'next/navigation'
import { fetchBillById } from '@/lib/supabase'
import ViewTracker from './ViewTracker'
import BackButton from './BackButton'
import ShareButton from './ShareButton'

const STATUS_STYLE: Record<string, string> = {
  '진행중': 'bg-blue-50 text-blue-600 border border-blue-200',
  '가결':   'bg-green-50 text-green-600 border border-green-200',
  '부결':   'bg-red-50 text-red-600 border border-red-200',
  '공포':   'bg-violet-50 text-violet-600 border border-violet-200',
  '철회':   'bg-slate-100 text-slate-500 border border-slate-200',
  '폐기':   'bg-slate-100 text-slate-500 border border-slate-200',
}

const AI_ITEMS = [
  { label: '발의 이유',          key: 'ai_reason' },
  { label: '핵심 내용',          key: 'ai_content' },
  { label: '기대되는 효과',      key: 'ai_benefit' },
  { label: '고려해야 할 점',     key: 'ai_consideration' },
] as const

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bill = await fetchBillById(id)
  if (!bill) notFound()

  const statusCls = STATUS_STYLE[bill.status ?? ''] ?? 'bg-slate-100 text-slate-500 border border-slate-200'
  const hasAi = bill.ai_reason || bill.ai_content || bill.ai_benefit || bill.ai_consideration

  return (
    <main className="max-w-2xl mx-auto px-4 pt-[116px] pb-20">
      <ViewTracker billId={id} />

      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs text-slate-400 font-mono flex-shrink-0">{bill.bill_no}</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusCls}`}>
            {bill.status ?? '—'}
          </span>
          {bill.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
              {bill.category}
            </span>
          )}
        </div>
        <h1 className="text-lg font-bold text-slate-800 leading-snug mb-3">{bill.bill_name}</h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-500">
          <span><span className="text-slate-400 text-xs mr-1">제안일자</span>{bill.propose_dt ?? '—'}</span>
          {bill.proposer && (
            <span><span className="text-slate-400 text-xs mr-1">전체 제안자</span>{bill.proposer}</span>
          )}
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-slate-400">조회 {bill.view_count.toLocaleString()}</span>
            <ShareButton title={bill.bill_name} billNo={bill.bill_no} />
          </div>
        </div>
      </div>

      {/* AI 요약 */}
      {hasAi && (
        <section className="mb-6">
          <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-800 leading-relaxed">
            ※ AI가 자동 생성한 요약입니다. 중요한 내용은 반드시 법률안 원문을 확인해 주세요.
          </div>

          <h2 className="text-base font-bold text-slate-700 mb-3">AI 요약</h2>
          <ul className="space-y-4">
            {AI_ITEMS.map(({ label, key }) => {
              const value = bill[key]
              if (!value) return null
              return (
                <li key={key} className="flex gap-2">
                  <span className="text-blue-300 flex-shrink-0 mt-0.5">•</span>
                  <span>
                    <span className="text-sm font-semibold text-slate-700">{label}</span>
                    <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{value}</p>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* 제안이유 및 주요내용 원본 (드롭다운) */}
      {bill.summary && (
        <section className="mb-6">
          <details className="group border border-slate-200 rounded-xl overflow-hidden">
            <summary className="flex items-center justify-between px-4 py-4 cursor-pointer select-none bg-slate-50 active:bg-slate-100 transition-colors list-none">
              <span className="text-sm font-bold text-slate-700">제안 이유 및 주요 내용 (원본)</span>
              <span className="text-slate-400 text-xs transition-transform group-open:rotate-180 ml-4 flex-shrink-0">▼</span>
            </summary>
            <div className="px-4 py-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-white">
              {bill.summary}
            </div>
          </details>
        </section>
      )}

      {/* 원본 발의안 보기 */}
      {bill.detail_link && (
        <section className="mb-6">
          <h2 className="text-base font-bold text-slate-700 mb-2">원본 발의안 보기</h2>
          <a
            href={bill.detail_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium py-1 active:opacity-70 transition-opacity"
          >
            국회의안정보시스템에서 보기 →
          </a>
        </section>
      )}

      {/* 진행 단계 */}
      <section className="mb-6">
        <h2 className="text-base font-bold text-slate-700 mb-4">진행 단계</h2>
        <div className="relative">
          {([
            {
              label: '발의',
              active: true,
              rows: [
                { label: '제안일',            value: bill.propose_dt },
                { label: '대표 제안자',        value: bill.rst_proposer },
                { label: '전체 제안자',        value: bill.proposer },
                { label: '전체 제안자 목록',   value: bill.member_list, isLink: true },
              ],
            },
            {
              label: '소관위원회',
              active: !!(bill.committee || bill.jrcmit_cmmt_dt || bill.jrcmit_prsnt_dt || bill.jrcmit_proc_dt || bill.jrcmit_proc_rslt),
              rows: [
                { label: '소관위원회', value: bill.committee },
                { label: '회부일',     value: bill.jrcmit_cmmt_dt },
                { label: '상정일',     value: bill.jrcmit_prsnt_dt },
                { label: '처리일',     value: bill.jrcmit_proc_dt },
                { label: '처리결과',   value: bill.jrcmit_proc_rslt },
              ],
            },
            {
              label: '법제사법위원회',
              active: !!(bill.law_cmmt_dt || bill.law_prsnt_dt || bill.law_proc_dt || bill.law_proc_rslt),
              rows: [
                { label: '회부일',   value: bill.law_cmmt_dt },
                { label: '상정일',   value: bill.law_prsnt_dt },
                { label: '처리일',   value: bill.law_proc_dt },
                { label: '처리결과', value: bill.law_proc_rslt },
              ],
            },
            {
              label: '본회의',
              active: !!(bill.rgs_prsnt_dt || bill.rgs_rsln_dt || bill.rgs_conf_rslt),
              rows: [
                { label: '심의 상정일', value: bill.rgs_prsnt_dt },
                { label: '심의 의결일', value: bill.rgs_rsln_dt },
                { label: '심의결과',    value: bill.rgs_conf_rslt },
              ],
            },
          ] as const).map((stage, i, arr) => (
            <div key={stage.label} className="flex gap-4">
              {/* 타임라인 선 + 점 */}
              <div className="flex flex-col items-center w-4 flex-shrink-0">
                <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ring-2 ring-white ${stage.active ? 'bg-blue-500' : 'bg-slate-200'}`} />
                {i < arr.length - 1 && (
                  <div className={`w-0.5 flex-1 my-1 min-h-[1.5rem] ${stage.active ? 'bg-blue-200' : 'bg-slate-100'}`} />
                )}
              </div>

              {/* 내용 */}
              <div className={`flex-1 pb-5 ${i === arr.length - 1 ? 'pb-0' : ''}`}>
                <p className={`text-sm font-bold mb-2 ${stage.active ? 'text-blue-600' : 'text-slate-300'}`}>
                  {stage.label}
                </p>

                {stage.active && (
                  <dl className="space-y-1.5">
                    {(stage.rows as unknown as { label: string; value: string | null; isLink?: boolean }[]).map(({ label, value, isLink }) => {
                      if (!value) return null
                      return (
                        <div key={label} className="flex gap-2 text-sm">
                          <dt className="text-slate-400 flex-shrink-0 w-24 text-xs leading-5">{label}</dt>
                          <dd className="text-slate-700 leading-5 break-all">
                            {isLink ? (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 underline underline-offset-2"
                              >
                                목록 보기
                              </a>
                            ) : value}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 발의안 의견 남기기 */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5" id="opinion">
        <h2 className="text-base font-bold text-slate-700 mb-4">발의안 의견 남기기</h2>
        <ol className="space-y-3 text-sm text-slate-600 mb-4">
          {[
            '국회입법예고 사이트 접속',
            '진행 중 입법예고 클릭',
            '법률안명 검색',
            '의견 남기기',
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 font-bold">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-400 mb-4">※ 의견은 본회의 심사 전까지만 남길 수 있습니다.</p>
        <a
          href="https://pal.assembly.go.kr/napal/main/main.do"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold text-center hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          국회 입법예고 바로가기
        </a>
      </section>

      <BackButton />

    </main>
  )
}
