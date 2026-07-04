'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Report = {
  id: number
  page_url: string | null
  description: string
  is_resolved: boolean
  created_at: string
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

export default function ReportsPage() {
  const [items, setItems] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const token = await getToken()
    const res = await fetch('/api/admin/reports', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }

  async function toggleResolved(id: number, current: boolean) {
    const token = await getToken()
    const res = await fetch(`/api/admin/reports?id=${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: !current }),
    })
    if (res.ok) setItems(prev => prev.map(r => r.id === id ? { ...r, is_resolved: !current } : r))
  }

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>

  const pending  = items.filter(r => !r.is_resolved)
  const resolved = items.filter(r =>  r.is_resolved)

  function ReportCard({ report }: { report: Report }) {
    return (
      <div className={`bg-white border rounded-lg p-4 ${report.is_resolved ? 'border-slate-100 opacity-60' : 'border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{report.description}</p>
            {report.page_url && (
              <p className="text-xs text-slate-400 mt-1 truncate">페이지: {report.page_url}</p>
            )}
            <p className="text-xs text-slate-300 mt-2">
              {new Date(report.created_at).toLocaleString('ko-KR')}
            </p>
          </div>
          <button
            onClick={() => toggleResolved(report.id, report.is_resolved)}
            className={`text-xs flex-shrink-0 px-2.5 py-1 rounded-full border transition-colors ${
              report.is_resolved
                ? 'border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-500'
                : 'border-green-200 text-green-600 hover:bg-green-50'
            }`}
          >
            {report.is_resolved ? '미처리로 변경' : '처리 완료'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-base font-bold text-slate-800 mb-4">
        오류 신고 <span className="text-slate-400 font-normal text-sm ml-1">미처리 {pending.length}건</span>
      </h1>

      {pending.length === 0 && resolved.length === 0 && (
        <p className="text-sm text-slate-400">접수된 오류 신고가 없습니다.</p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3 mb-8">
          {pending.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-3">처리 완료 ({resolved.length}건)</p>
          <div className="flex flex-col gap-3">
            {resolved.map(r => <ReportCard key={r.id} report={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
