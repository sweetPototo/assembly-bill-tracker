import { NextRequest, NextResponse } from 'next/server'
import { serviceSupabase } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const description = (body.description ?? '').trim()
  if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const { error } = await serviceSupabase
    .from('error_reports')
    .insert({ page_url: body.page_url ?? null, description })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
