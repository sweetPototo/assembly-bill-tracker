import { createClient } from '@supabase/supabase-js'
import ForeignView from '@/components/ForeignView'
import { Article } from '@/lib/supabase'

async function fetchTodayForeignArticles(): Promise<Article[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const kstStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const start  = new Date(kstStr)
  const end    = new Date(kstStr); end.setHours(23, 59, 59, 999)

  const { data } = await supabase
    .from('articles')
    .select('id,title,published_at,publisher,view_count,category,isforeign,origin_url')
    .gte('published_at', start.toISOString())
    .lte('published_at', end.toISOString())
    .eq('isforeign', 1)
    .order('published_at', { ascending: false })
    .limit(50)

  return (data as Article[]) ?? []
}

export default async function ForeignPage() {
  const articles = await fetchTodayForeignArticles()

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-[100px]">
        <ForeignView initialArticles={articles} />
      </div>
    </div>
  )
}
