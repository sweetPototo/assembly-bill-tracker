'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()

  const handleClick = () => {
    sessionStorage.setItem('billList_navigate_back', '1')
    router.back()
  }

  return (
    <div className="flex justify-end mt-8">
      <button
        onClick={handleClick}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
      >
        목록
      </button>
    </div>
  )
}
