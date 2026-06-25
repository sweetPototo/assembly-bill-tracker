import { createClient } from '@supabase/supabase-js'
import TopNav from '@/components/TopNav'
import KeywordTimeline, { TimelineArticle } from '@/components/KeywordTimeline'

async function fetchTimelineData(): Promise<TimelineArticle[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const today = new Date()
  const from  = new Date(today)
  from.setDate(from.getDate() - 6)

  const { data } = await supabase
    .from('articles')
    .select('id,title,published_at,publisher,view_count,keywords')
    .gte('published_at', from.toISOString())
    .order('published_at', { ascending: false })

  return (data as TimelineArticle[]) ?? []
}

export default async function HomePage() {
  const articles = await fetchTimelineData()
  return (
    <div className="min-h-screen bg-slate-950">
      <TopNav />
      <div className="pt-[100px]">
        <KeywordTimeline articles={articles} />
      </div>
    </div>
  )
}
