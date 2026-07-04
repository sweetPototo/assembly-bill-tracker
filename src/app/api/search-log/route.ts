import { NextRequest, NextResponse } from 'next/server'
import { serviceSupabase } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const { term } = await req.json()
    const cleaned = (term ?? '').trim()
    if (cleaned.length < 2 || cleaned.length > 50) {
      return NextResponse.json({ ok: false })
    }
    await serviceSupabase.from('search_logs').insert({ term: cleaned })
  } catch {
    // fire-and-forget: 로그 실패가 메인 기능에 영향 없도록 조용히 무시
  }
  return NextResponse.json({ ok: true })
}
