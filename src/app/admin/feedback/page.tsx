'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Feedback = {
  id: number
  content: string
  contact: string | null
  created_at: string
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const token = await getToken()
    const res = await fetch('/api/admin/feedback', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  async function remove(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    const token = await getToken()
    const res = await fetch(`/api/admin/feedback?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setItems(prev => prev.filter(f => f.id !== id))
  }

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>

  return (
    <div>
      <h1 className="text-base font-bold text-slate-800 mb-4">
        받은 피드백 <span className="text-slate-400 font-normal text-sm ml-1">{items.length}건</span>
      </h1>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">접수된 피드백이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{item.content}</p>
                  {item.contact && (
                    <p className="text-xs text-slate-500 mt-1">연락처: {item.contact}</p>
                  )}
                  <p className="text-xs text-slate-300 mt-2">
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
