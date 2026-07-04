import { NextResponse } from 'next/server'
import { serviceSupabase } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await serviceSupabase
    .from('popular_searches_30d')
    .select('term, cnt')
  return NextResponse.json(data ?? [])
}
