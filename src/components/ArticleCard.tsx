'use client'

import Link from 'next/link'
import { Article, CATEGORY_STYLE, CATEGORIES } from '@/lib/supabase'

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const style    = CATEGORY_STYLE[article.category]
  const catLabel = CATEGORIES.find(c => c.id === article.category)?.label ?? ''

  const timeLabel = new Date(article.published_at).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month:    'numeric',
    day:      'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
  })

  return (
    <Link href={`/article/${article.id}`} className="block">
      <article className="flex flex-col gap-2.5 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3.5 hover:border-slate-600 hover:bg-slate-800/60 active:scale-[0.99] transition-all cursor-pointer">

        {/* 헤더: 언론사 + 카테고리 + 시간 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md">
            {article.publisher}
          </span>
          {style && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${style.badge}`}>
              {catLabel}
            </span>
          )}
          <span className="ml-auto text-xs text-slate-500 flex-shrink-0">{timeLabel}</span>
        </div>

        {/* 기사 제목 */}
        <h2 className="text-[15px] font-bold text-slate-100 leading-snug line-clamp-2">
          {article.title}
        </h2>

      </article>
    </Link>
  )
}
