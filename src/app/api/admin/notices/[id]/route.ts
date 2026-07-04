import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, serviceSupabase } from '@/lib/admin-auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title   !== undefined) update.title        = body.title.trim()
  if (body.content !== undefined) update.content      = body.content.trim()
  if (body.is_published !== undefined) update.is_published = body.is_published

  const { data, error } = await serviceSupabase
    .from('notices')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await verifyAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { error } = await serviceSupabase.from('notices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
