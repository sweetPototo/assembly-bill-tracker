import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '@/components/TopNav'
import CategoryView from '@/components/CategoryView'
import { Article } from '@/lib/supabase'

const VALID_CATEGORIES = [0, 1, 2, 3]

async function fetchTodayArticles(category: number): Promise<Article[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const kstStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const start  = new Date(kstStr)
  const end    = new Date(kstStr); end.setHours(23, 59, 59, 999)

  const { data } = await supabase
    .from('articles')
    .select('id,title,published_at,publisher,view_count,category,origin_url')
    .gte('published_at', start.toISOString())
    .lte('published_at', end.toISOString())
    .eq('category', category)
    .order('published_at', { ascending: false })
    .limit(50)

  return (data as Article[]) ?? []
}

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const category = Number(id)
  if (!VALID_CATEGORIES.includes(category)) notFound()

  const articles = await fetchTodayArticles(category)

  return (
    <div className="min-h-screen bg-white">
      <TopNav />
      <div className="pt-[100px]">
        <CategoryView initialArticles={articles} category={category} />
      </div>
    </div>
  )
}
