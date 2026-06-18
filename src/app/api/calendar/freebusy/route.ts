import { NextRequest, NextResponse } from 'next/server'
import { getFreeBusy } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  try {
    const busy = await getFreeBusy(start, end)
    return NextResponse.json({ busy })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
