'use client'

export default function BackButton() {
  return (
    <div className="flex justify-end mt-8">
      <button
        onClick={() => window.close()}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
      >
        창 닫기
      </button>
    </div>
  )
}
