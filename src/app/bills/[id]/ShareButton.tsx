'use client'

import { useState } from 'react'

interface Props {
  title: string
  billNo: string
}

export default function ShareButton({ title, billNo }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url  = window.location.href
    const text = `[${billNo}] ${title}`

    if (navigator.share) {
      await navigator.share({ title: text, url }).catch(() => {})
      return
    }

    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors flex-shrink-0"
    >
      {copied ? (
        <>✓ 복사됨</>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          공유
        </>
      )}
    </button>
  )
}
