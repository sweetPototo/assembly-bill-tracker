import CloseButton from './CloseButton'

const METHODS = [
  {
    title: '1. 국회의안정보시스템 이용하기',
    steps: [
      { label: '국회의안정보시스템에서 보기 클릭', image: '의안정보시스템1.png' },
      { label: '의안명 오른쪽 [입법예고중] 클릭',   image: '의안정보시스템2.png' },
      { label: '의견 남기기',                       image: '의안정보시스템3.png' },
    ],
  },
  {
    title: '2. 국회 입법예고 이용하기',
    steps: [
      { label: '국회입법예고 사이트 접속',   image: '입법예고1.png' },
      { label: '진행 중 입법예고 클릭',      image: '입법예고2.png' },
      { label: '법률안명 검색',              image: '입법예고3.png' },
      { label: '의견 남기기',                image: '입법예고4.png' },
    ],
  },
] as const

export default function OpinionGuidePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 pt-[116px] pb-20">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-800 mb-1">발의안 의견 남기기 도움말</h1>
        <p className="text-xs text-slate-400">※ 의견은 본회의 심사 전까지만 남길 수 있습니다.</p>
      </div>

      <div className="space-y-8">
        {METHODS.map(method => (
          <section key={method.title}>
            <h2 className="text-base font-bold text-slate-700 mb-4">{method.title}</h2>
            <ol className="space-y-6">
              {method.steps.map((step, i) => (
                <li key={step.label}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center flex-shrink-0 font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-600">{step.label}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/opinion-guide/${step.image}`}
                    alt={step.label}
                    className="w-full rounded-xl border border-slate-200"
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <CloseButton />
    </main>
  )
}
