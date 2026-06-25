'use client'

import { useState } from 'react'
import { supabase, Article } from '@/lib/supabase'
import WeeklyDatePicker from '@/components/WeeklyDatePicker'
import ArticleCard from '@/components/ArticleCard'

interface Props {
  initialArticles: Article[]
}

function getTodayKST(): Date {
  const kstStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return new Date(kstStr)
}

export default function ForeignView({ initialArticles }: Props) {
  const [articles,     setArticles]     = useState<Article[]>(initialArticles)
  const [loading,      setLoading]      = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(getTodayKST)

  const handleDateChange = async (date: Date) => {
    setSelectedDate(date)
    setLoading(true)

    const start = new Date(date); start.setHours(0,  0,  0,   0)
    const end   = new Date(date); end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('articles')
      .select('id,title,published_at,publisher,view_count,category,isforeign,origin_url')
      .gte('published_at', start.toISOString())
      .lte('published_at', end.toISOString())
      .eq('isforeign', 1)
      .order('published_at', { ascending: false })
      .limit(50)

    if (!error) setArticles((data as Article[]) ?? [])
    setLoading(false)
  }

  const dateLabel = selectedDate.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month:    'long',
    day:      'numeric',
    weekday:  'short',
  })

  return (
    <>
      <div className="fixed left-0 right-0 top-[100px] z-[60] bg-slate-950 border-b border-slate-800">
        <WeeklyDatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
      </div>

      <main className="max-w-6xl mx-auto px-4 pt-[68px] pb-6">

        <div className="mb-5">
          <h1 className="text-lg font-bold text-slate-100">{dateLabel}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {loading ? '불러오는 중…' : `${articles.length}건의 외신 기사`}
          </p>
        </div>

        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 h-16 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 text-slate-500">
            <span className="text-5xl mb-4">🌏</span>
            <p className="text-base font-semibold">해당 날짜의 외신 기사가 없습니다</p>
            <p className="text-sm mt-1.5">다른 날짜를 선택하거나 크롤러를 실행해 주세요</p>
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div className="flex flex-col gap-2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

      </main>
    </>
  )
}
