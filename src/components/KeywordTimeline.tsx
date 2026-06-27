'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TOP_KEYWORDS   = 3
const TOP_ARTICLES   = 3
const TIMELINE_WEEKS = 4
const DAYS_PER_WEEK  = 7

export interface TimelineArticle {
  id: string
  title: string
  published_at: string
  publisher: string
  view_count: number
  keywords: string[]
}

interface WeekKeyword {
  keyword: string
  count: number
  totalViews: number
  articles: TimelineArticle[]
}

interface WeekEntry {
  weekIndex: number
  label: string
  dateRange: string
  keywords: WeekKeyword[]
  totalArticles: number
}

interface Props {
  articles: TimelineArticle[]
}

// ─── 날짜 헬퍼 ────────────────────────────────────────────────

const toKSTDateStr = (d: Date): string =>
  d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })

// ─── 키워드 집계 ──────────────────────────────────────────────

function buildKeywords(weekArticles: TimelineArticle[]): WeekKeyword[] {
  const map = new Map<string, { count: number; totalViews: number; articles: TimelineArticle[] }>()

  for (const article of weekArticles) {
    for (const kw of (article.keywords ?? [])) {
      if (!map.has(kw)) map.set(kw, { count: 0, totalViews: 0, articles: [] })
      const entry = map.get(kw)!
      entry.count++
      entry.totalViews += article.view_count ?? 0
      entry.articles.push(article)
    }
  }

  return Array.from(map.entries())
    .map(([keyword, { count, totalViews, articles }]) => ({
      keyword, count, totalViews,
      articles: [...articles]
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, TOP_ARTICLES),
    }))
    .sort((a, b) => b.count - a.count || b.totalViews - a.totalViews)
    .slice(0, TOP_KEYWORDS)
}

const WEEK_LABELS = ['이번 주', '지난 주', '2주 전', '3주 전']

function buildWeeks(articles: TimelineArticle[]): WeekEntry[] {
  const todayStr = toKSTDateStr(new Date())

  return Array.from({ length: TIMELINE_WEEKS }, (_, weekIndex) => {
    // weekIndex 0: 오늘~6일 전 / 1: 7~13일 전 / 2: 14~20일 전 / 3: 21~27일 전
    const endOffset   = weekIndex * DAYS_PER_WEEK         // 0, 7, 14, 21
    const startOffset = endOffset + DAYS_PER_WEEK - 1     // 6, 13, 20, 27

    const endStr   = toKSTDateStr(new Date(new Date(todayStr).getTime() - endOffset   * 86_400_000))
    const startStr = toKSTDateStr(new Date(new Date(todayStr).getTime() - startOffset * 86_400_000))

    const weekArticles = articles.filter(a => {
      const d = toKSTDateStr(new Date(a.published_at))
      return d >= startStr && d <= endStr
    })

    const [, sm, sd] = startStr.split('-').map(Number)
    const [, em, ed] = endStr.split('-').map(Number)

    return {
      weekIndex,
      label: WEEK_LABELS[weekIndex],
      dateRange: `${sm}월 ${sd}일 ~ ${em}월 ${ed}일`,
      keywords: buildKeywords(weekArticles),
      totalArticles: weekArticles.length,
    }
  })
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

export default function KeywordTimeline({ articles }: Props) {
  const weeks = buildWeeks(articles)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {weeks.map((week, wi) => {
        const isLast = wi === weeks.length - 1
        return (
          <div key={week.weekIndex} className="flex gap-4">

            <div className="flex flex-col items-center w-16 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-[18px] shrink-0" />
              {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1" />}
            </div>

            <div className="flex-1 min-w-0 pb-8">
              <div className="mb-3 mt-3">
                <p className="text-sm font-bold text-blue-600">{week.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{week.dateRange}</p>
              </div>

              {week.keywords.length === 0 ? (
                <p className="text-sm text-slate-600 pl-1">
                  {week.totalArticles > 0
                    ? `기사 ${week.totalArticles}건 (키워드 분석 준비 중)`
                    : '기사 없음'}
                </p>
              ) : (
                <div className="space-y-2">
                  {week.keywords.map(kw => {
                    const expandKey = `${week.weekIndex}-${kw.keyword}`
                    const isOpen    = expanded.has(expandKey)
                    return (
                      <div
                        key={kw.keyword}
                        className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(expandKey)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm font-semibold text-slate-900 truncate">
                              {kw.keyword}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">
                              {kw.count}건
                            </span>
                          </div>
                          {isOpen
                            ? <ChevronUp   className="w-4 h-4 text-slate-500 shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                          }
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-200 divide-y divide-slate-200">
                            {kw.articles.map(article => (
                              <Link
                                key={article.id}
                                href={`/article/${article.id}`}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-800 line-clamp-2 leading-snug group-hover:text-slate-900 transition-colors">
                                    {article.title}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {article.publisher} · {formatDateTime(article.published_at)}
                                    {(article.view_count ?? 0) > 0 && (
                                      <span className="ml-2">조회 {article.view_count.toLocaleString()}</span>
                                    )}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
