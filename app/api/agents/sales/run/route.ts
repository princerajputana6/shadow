import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) {
    return NextResponse.json({ error: 'Agent runner not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${runnerUrl}/agents/sales/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
      body: JSON.stringify({ userId: session.user.id })
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: 'Runner unreachable', detail: String(e) }, { status: 502 })
  }
}
