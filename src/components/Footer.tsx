'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

const DISCLAIMER =
  '본 사이트의 법률안 정보는 대한민국 국회에서 제공하는 Open API를 기반으로 제공됩니다. ' +
  'AI 요약은 법률안의 이해를 돕기 위해 자동 생성된 참고 자료이며, 법적 효력이나 공식 해석을 갖지 않습니다. ' +
  '실제 법률안의 정확한 내용은 국회에서 제공하는 원문을 반드시 확인하시기 바랍니다. ' +
  'AI 요약 및 분석 결과는 오류가 있을 수 있으며, 이를 근거로 한 의사결정에 대한 책임은 이용자에게 있습니다.'

type ModalType = 'report' | 'feedback' | null

export default function Footer() {
  const pathname = usePathname()
  const [modal, setModal] = useState<ModalType>(null)
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (pathname?.startsWith('/admin')) return null

  function closeModal() {
    setModal(null)
    setText('')
    setContact('')
    setDone(false)
  }

  async function submit() {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    const url  = modal === 'report' ? '/api/reports' : '/api/feedback'
    const body = modal === 'report'
      ? { page_url: pathname, description: text.trim() }
      : { content: text.trim(), contact: contact.trim() || null }

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <footer className="border-t border-slate-200 bg-slate-50 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto">
            {DISCLAIMER}
          </p>
        </div>
      </footer>

      {modal && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-700 font-medium">
                  {modal === 'report' ? '신고가 접수되었습니다.' : '소중한 의견 감사합니다.'}
                </p>
                <button
                  onClick={closeModal}
                  className="mt-4 text-xs px-4 py-2 rounded-full bg-slate-800 text-white"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-bold text-slate-800 mb-3">
                  {modal === 'report' ? '오류 신고' : '관리자에게 한마디'}
                </h2>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={modal === 'report' ? '어떤 오류가 있었는지 알려주세요.' : '전하고 싶은 말씀을 남겨주세요.'}
                  rows={4}
                  autoFocus
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {modal === 'feedback' && (
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="답변받을 연락처 (선택)"
                    className="w-full text-sm border border-slate-200 rounded-lg p-3 mt-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                )}
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={closeModal}
                    className="text-xs px-4 py-2 rounded-full text-slate-500 hover:bg-slate-100"
                  >
                    취소
                  </button>
                  <button
                    onClick={submit}
                    disabled={!text.trim() || submitting}
                    className="text-xs px-4 py-2 rounded-full bg-blue-500 text-white disabled:opacity-40"
                  >
                    {submitting ? '전송 중...' : '보내기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
