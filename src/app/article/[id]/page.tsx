import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TopNav from '@/components/TopNav'
import ArticleDetail, { Comment } from '@/components/ArticleDetail'
import { Article } from '@/lib/supabase'

async function fetchArticleAndComments(
  id: string,
): Promise<{ article: Article | null; comments: Comment[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const [articleRes, commentsRes] = await Promise.all([
    supabase.from('articles').select('*').eq('id', id).single(),
    supabase
      .from('comments')
      .select('*')
      .eq('article_id', id)
      .order('created_at', { ascending: false }),
  ])

  return {
    article: (articleRes.data as Article) ?? null,
    comments: (commentsRes.data as Comment[]) ?? [],
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { article, comments } = await fetchArticleAndComments(id)

  if (!article) notFound()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopNav />
      <ArticleDetail article={article} initialComments={comments} />
    </div>
  )
}
