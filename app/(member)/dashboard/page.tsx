import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AgentRun from '@/models/AgentRun'
import { connectDB } from '@/lib/mongoose'
import { getRosterWithStatus } from '@/lib/agentRoster'
import { AgentChips } from '@/components/dashboard/AgentChips'
import { SecurityPostureCard } from '@/components/dashboard/SecurityPostureCard'
import { CurrentDirectiveCard } from '@/components/dashboard/CurrentDirectiveCard'
import { ContextWindowCard } from '@/components/dashboard/ContextWindowCard'
import { VpsHealthCard } from '@/components/dashboard/VpsHealthCard'
import { TelemetryRow } from '@/components/dashboard/TelemetryRow'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CommandCenterPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  await connectDB()
  const [roster, latestRun, runs24h, totalRuns, allFails] = await Promise.all([
    getRosterWithStatus(userId),
    AgentRun.findOne({ userId }).sort({ startedAt: -1 }).lean(),
    AgentRun.countDocuments({ userId, startedAt: { $gte: new Date(Date.now() - 86400_000) } }),
    AgentRun.countDocuments({ userId }),
    AgentRun.countDocuments({ userId, status: 'failed' })
  ])

  const loadsAgg = await AgentRun.aggregate([
    { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId) } },
    { $group: { _id: '$agentName', runs: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }
  ])
  const loads = loadsAgg.map(l => ({ name: l._id, runs: l.runs, failed: l.failed }))

  // Telemetry estimates — best-effort from what we have
  const integrity = Math.max(0, 100 - Math.round((allFails / Math.max(1, totalRuns)) * 100))
  const tokensIn = totalRuns * 1800   // ballpark — replace with real telemetry when we track per-call tokens

  const now = new Date()
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

  return (
    <div className="space-y-6">
      {/* Title row */}
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Command Center</p>
          <h1 className="text-3xl font-semibold tracking-tight">Growth operations dashboard.</h1>
          <p className="text-sm text-muted mt-1">Business outcomes first, with live agent telemetry supporting operator decisions.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 px-2.5 py-1 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Agentic System Operational
          </span>
          <span className="text-muted font-mono">{ts}</span>
        </div>
      </header>

      {/* Agent chips strip */}
      <AgentChips roster={roster} />

      {/* Main grid: Security · Directive+Context · VPS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1">
          <SecurityPostureCard />
        </div>
        <div className="lg:col-span-2 space-y-5">
          <CurrentDirectiveCard latestRun={latestRun as never} />
          <ContextWindowCard roster={roster} loads={loads} />
        </div>
        <div className="lg:col-span-1">
          <VpsHealthCard />
        </div>
      </div>

      {/* Telemetry row */}
      <TelemetryRow
        integrity={integrity}
        agentCalls={runs24h}
        messages={totalRuns * 38}
        tokensIn={tokensIn}
        errors={allFails}
      />

      <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Chat with an agent</div>
      <AgentChips roster={roster} />
    </div>
  )
}
