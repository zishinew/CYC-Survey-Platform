import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_KEY = process.env.SUPABASE_KEY
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE env vars' }, { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Get count of completed response sessions (use exact count)
    const countRes = await supabase
      .from('response_sessions')
      .select('id', { count: 'exact' })

    if (countRes.error) {
      return NextResponse.json({ error: countRes.error.message }, { status: 500 })
    }

    const total = (countRes.count as number) || 0
    if (total === 0) return NextResponse.json({ email: null })

    const pos = Math.floor(Math.random() * total)

    const rows = await supabase
      .from('response_sessions')
      .select('email')
      .order('id')
      .range(pos, pos)

    if (rows.error) {
      return NextResponse.json({ error: rows.error.message }, { status: 500 })
    }

    const email = Array.isArray(rows.data) && rows.data.length > 0 ? (rows.data[0] as any).email : null
    return NextResponse.json({ email })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
