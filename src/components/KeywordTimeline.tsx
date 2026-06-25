'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TOP_KEYWORDS  = 3
const TOP_ARTICLES  = 3
const TIMELINE_DAYS = 7

export interface TimelineArticle {
  id: string
  title: string
  published_at: string
  publisher: string
  view_count: number
  keywords: string[]
}

interface DayKeyword {
  keyword: string
  count: number
  totalViews: number
  articles: TimelineArticle[]
}

interface DayEntry {
  dateStr: string   // KST 기준 'YYYY-MM-DD'
  label: string
  keywords: DayKeyword[]
  totalArticles: number
}

interface Props {
  articles: TimelineArticle[]
}

// ─── 날짜 헬퍼 ────────────────────────────────────────────────
//
// 핵심: timeZone을 명시하면 서버(UTC)와 클라이언트(KST) 모두
// 동일한 문자열을 반환 → React hydration 불일치 없음
//
// 'sv-SE' 로케일은 'YYYY-MM-DD' 형식을 반환해 파싱이 쉬움

const toKSTDateStr = (d: Date): string =>
  d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const makeDateLabel = (dateStr: string, todayStr: string): string => {
  // 두 'YYYY-MM-DD' 문자열을 UTC 기준으로 파싱하면 하루 차이 계산이 정확
  const diff = Math.round(
    (new Date(todayStr).getTime() - new Date(dateStr).getTime()) / 86_400_000
  )
  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}월 ${d}일`
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
  })

// ─── 키워드 집계 ──────────────────────────────────────────────

function buildKeywords(dayArticles: TimelineArticle[]): DayKeyword[] {
  const map = new Map<string, { count: number; totalViews: number; articles: TimelineArticle[] }>()

  for (const article of dayArticles) {
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

// timeZone 명시 덕분에 서버·클라이언트가 동일한 결과를 내므로
// useEffect 없이 동기 계산 가능 → SSR에서 실제 콘텐츠를 HTML에 포함
function buildDays(articles: TimelineArticle[]): DayEntry[] {
  const todayStr = toKSTDateStr(new Date())

  return Array.from({ length: TIMELINE_DAYS }, (_, i) => {
    // 'YYYY-MM-DD' → UTC 00:00 파싱 후 하루씩 감산
    const dateStr = toKSTDateStr(new Date(new Date(todayStr).getTime() - i * 86_400_000))
    const dayArticles = articles.filter(
      a => toKSTDateStr(new Date(a.published_at)) === dateStr
    )
    return { dateStr, label: makeDateLabel(dateStr, todayStr), keywords: buildKeywords(dayArticles), totalArticles: dayArticles.length }
  })
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

export default function KeywordTimeline({ articles }: Props) {
  // buildDays는 타임존 명시로 서버·클라이언트 결과가 동일 → 동기 호출 OK
  const days = buildDays(articles)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {days.map((day, di) => {
        const isLast = di === days.length - 1
        return (
          <div key={day.dateStr} className="flex gap-4">

            <div className="flex flex-col items-center w-16 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-[18px] shrink-0" />
              {!isLast && <div className="w-px flex-1 bg-slate-700 mt-1" />}
            </div>

            <div className="flex-1 min-w-0 pb-8">
              <p className="text-sm font-bold text-blue-400 mb-3 mt-3">{day.label}</p>

              {day.keywords.length === 0 ? (
                <p className="text-sm text-slate-600 pl-1">
                  {day.totalArticles > 0 ? `기사 ${day.totalArticles}건 (키워드 분석 준비 중)` : '기사 없음'}
                </p>
              ) : (
                <div className="space-y-2">
                  {day.keywords.map(kw => {
                    const expandKey = `${day.dateStr}-${kw.keyword}`
                    const isOpen    = expanded.has(expandKey)
                    return (
                      <div
                        key={kw.keyword}
                        className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden"
                      >
                        <button
                          onClick={() => toggle(expandKey)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm font-semibold text-slate-100 truncate">
                              {kw.keyword}
                            </span>
                            <span className="text-xs text-slate-500 shrink-0">
                              {kw.count}건
                            </span>
                          </div>
                          {isOpen
                            ? <ChevronUp   className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          }
                        </button>

                        {isOpen && (
                          <div className="border-t border-slate-700/60 divide-y divide-slate-700/40">
                            {kw.articles.map(article => (
                              <Link
                                key={article.id}
                                href={`/article/${article.id}`}
                                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors group"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                                    {article.title}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {article.publisher} · {formatTime(article.published_at)}
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
