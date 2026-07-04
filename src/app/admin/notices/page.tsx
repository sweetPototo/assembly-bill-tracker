'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Notice = {
  id: number
  title: string
  content: string
  is_published: boolean
  created_at: string
  updated_at: string
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

const EMPTY_FORM = { title: '', content: '' }

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<Notice | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const token = await getToken()
    const res = await fetch('/api/admin/notices', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setNotices(await res.json())
    setLoading(false)
  }

  function startEdit(notice: Notice) {
    setEditing(notice)
    setForm({ title: notice.title, content: notice.content })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSubmitting(true)
    const token = await getToken()

    if (editing) {
      const res = await fetch(`/api/admin/notices/${editing.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const updated = await res.json()
        setNotices(prev => prev.map(n => n.id === editing.id ? updated : n))
        cancelEdit()
      }
    } else {
      const res = await fetch('/api/admin/notices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const created = await res.json()
        setNotices(prev => [created, ...prev])
        setForm(EMPTY_FORM)
      }
    }
    setSubmitting(false)
  }

  async function togglePublish(id: number, current: boolean) {
    const token = await getToken()
    const res = await fetch(`/api/admin/notices/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !current }),
    })
    if (res.ok) {
      const updated = await res.json()
      setNotices(prev => prev.map(n => n.id === id ? updated : n))
    }
  }

  async function remove(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    const token = await getToken()
    const res = await fetch(`/api/admin/notices/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setNotices(prev => prev.filter(n => n.id !== id))
  }

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>

  return (
    <div>
      <h1 className="text-base font-bold text-slate-800 mb-4">공지사항</h1>

      {/* 작성/수정 폼 */}
      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <p className="text-sm font-medium text-slate-700 mb-3">
          {editing ? '공지 수정' : '새 공지 작성'}
        </p>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="제목"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <textarea
            placeholder="내용"
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            required
            rows={4}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
          />
          <div className="flex gap-2 justify-end">
            {editing && (
              <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? '저장 중...' : editing ? '수정 저장' : '등록'}
            </button>
          </div>
        </div>
      </form>

      {/* 공지 목록 */}
      {notices.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 공지사항이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notices.map(notice => (
            <div key={notice.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    notice.is_published
                      ? 'bg-green-50 text-green-600 border-green-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}>
                    {notice.is_published ? '게시됨' : '미게시'}
                  </span>
                  <p className="text-sm font-medium text-slate-800">{notice.title}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => togglePublish(notice.id, notice.is_published)}
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    {notice.is_published ? '숨기기' : '게시'}
                  </button>
                  <button onClick={() => startEdit(notice)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">수정</button>
                  <button onClick={() => remove(notice.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">삭제</button>
                </div>
              </div>
              <p className="text-xs text-slate-500 whitespace-pre-wrap line-clamp-2">{notice.content}</p>
              <p className="text-xs text-slate-300 mt-2">
                {new Date(notice.updated_at).toLocaleString('ko-KR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
