import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import AgentRun from '@/models/AgentRun'

export const runtime = 'nodejs'

const ALL_AGENTS = ['sales_finder', 'social_media', 'cto', 'developer'] as const

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()

  const lastRuns = await Promise.all(
    ALL_AGENTS.map(async (agentName) => {
      const run = await AgentRun.findOne({ userId: session.user.id, agentName })
        .sort({ startedAt: -1 })
        .lean()
      return { agentName, run }
    })
  )
  return NextResponse.json({ agents: lastRuns })
}
