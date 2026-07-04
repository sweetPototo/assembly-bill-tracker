import { NextRequest, NextResponse } from 'next/server'
import { serviceSupabase } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const content = (body.content ?? '').trim()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { error } = await serviceSupabase
    .from('feedback')
    .insert({ content, contact: body.contact ?? null })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
