import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)
  const { data: { user }, error } = await serviceSupabase.auth.getUser(token)
  return !error && !!user
}

export { serviceSupabase }
