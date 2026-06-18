import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import AgentRun from '@/models/AgentRun'
import { getRosterWithStatus } from '@/lib/agentRoster'
import { AgentNetworkGraph } from './_components/AgentNetworkGraph'
import { AgentLog } from './_components/AgentLog'

export const dynamic = 'force-dynamic'

export default async function AgentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  await connectDB()
  const [roster, recentRuns, totalRuns] = await Promise.all([
    getRosterWithStatus(userId),
    AgentRun.find({ userId }).sort({ startedAt: -1 }).limit(50).lean(),
    AgentRun.countDocuments({ userId })
  ])

  // Approximate counts for the orchestrator card
  const routes = roster.filter(r => r.status === 'working').length * 12 + 60
  const runs = totalRuns

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Agent Network</p>
        <h1 className="text-3xl font-semibold tracking-tight">One command brain coordinating five specialist agent roles.</h1>
      </header>

      <AgentNetworkGraph roster={roster} ceoStats={{ routes, runs, model: 'gemini-2.0-flash' }} />

      <AgentLog runs={recentRuns as never} />
    </div>
  )
}
