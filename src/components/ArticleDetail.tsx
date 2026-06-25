'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Send } from 'lucide-react'
import { supabase, Article, CATEGORY_STYLE, CATEGORIES } from '@/lib/supabase'

export interface Comment {
  id: number
  article_id: string
  nickname: string
  content: string
  created_at: string
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return '방금 전'
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

interface Props {
  article: Article
  initialComments: Comment[]
}

export default function ArticleDetail({ article, initialComments }: Props) {
  const router       = useRouter()
  const [comments,   setComments]   = useState<Comment[]>(initialComments)
  const [nickname,   setNickname]   = useState('')
  const [content,    setContent]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  const submitComment = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ article_id: article.id, nickname: nickname.trim() || '익명', content: content.trim() })
      .select()
      .single()
    if (!error && data) {
      setComments(prev => [data as Comment, ...prev])
      setContent('')
    }
    setSubmitting(false)
    textareaRef.current?.focus()
  }

  const style    = CATEGORY_STYLE[article.category]
  const catLabel = CATEGORIES.find(c => c.id === article.category)?.label ?? ''
  const timeLabel = new Date(article.published_at).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
  const bullets = article.summary
    ?.split('\n')
    .filter(l => l.trim().startsWith('•'))
    .map(l => l.replace(/^•\s*/, '').trim())
    .filter(Boolean) ?? []

  return (
    <div className="pt-[100px] max-w-xl mx-auto px-4 pb-20">

      {/* 뒤로가기 */}
      <div className="sticky top-[100px] z-40 bg-slate-950 pt-3 pb-3 -mx-4 px-4 border-b border-slate-800/60">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>
      </div>

      {/* 기사 상세 */}
      <section className="pt-5 pb-6 border-b border-slate-800">

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
            {article.publisher}
          </span>
          {style && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${style.badge}`}>
              {catLabel}
            </span>
          )}
          <span className="text-xs text-slate-500 ml-auto">{timeLabel}</span>
        </div>

        <h1 className="text-lg font-bold leading-snug mb-5">{article.title}</h1>

        {bullets.length > 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">AI 요약</p>
            <ul className="flex flex-col gap-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-200 leading-snug">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${style?.dot ?? 'bg-blue-400'}`} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={article.origin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-blue-400 hover:bg-slate-800 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          원본 기사 보기
        </a>
      </section>

      {/* 댓글 섹션 */}
      <section className="pt-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4">댓글 {comments.length}개</h2>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 mb-5 flex flex-col gap-2">
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="닉네임 (미입력 시 익명)"
            maxLength={20}
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none border-b border-slate-700 pb-2"
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitComment() }}
            placeholder="댓글을 입력하세요"
            rows={3}
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={submitComment}
              disabled={!content.trim() || submitting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? '등록 중…' : '등록'}
            </button>
          </div>
        </div>

        {comments.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-8">첫 댓글을 남겨보세요</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-800">
            {comments.map(comment => (
              <div key={comment.id} className="py-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-300">{comment.nickname}</span>
                  <span className="text-xs text-slate-600">{relativeTime(comment.created_at)}</span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
