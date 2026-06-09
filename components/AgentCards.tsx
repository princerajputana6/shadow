import { RunSalesAgentButton } from './RunSalesAgentButton'
import { formatDistanceToNow } from 'date-fns'

type Run = {
  status: 'running' | 'completed' | 'failed'
  startedAt: string | Date
  completedAt?: string | Date
  stats?: Record<string, unknown>
  errorMessage?: string
} | null

type AgentInfo = { agentName: 'sales_finder' | 'social_media' | 'cto' | 'developer'; run: Run }

const LABELS: Record<AgentInfo['agentName'], { name: string; phase: string }> = {
  sales_finder: { name: 'Sales Finder', phase: 'Phase 1' },
  social_media: { name: 'Social Media', phase: 'Phase 2' },
  cto: { name: 'CTO', phase: 'Phase 3' },
  developer: { name: 'Developer', phase: 'Phase 3' }
}

export function AgentCards({ agents }: { agents: AgentInfo[] }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {agents.map(({ agentName, run }) => {
        const meta = LABELS[agentName]
        const isPhase1 = agentName === 'sales_finder'
        const statusLabel = isPhase1
          ? (run?.status === 'running' ? 'Running' : run?.status === 'failed' ? 'Failed' : run ? 'Idle' : 'Never run')
          : meta.phase
        return (
          <div key={agentName} className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{meta.name}</p>
                <p className="mt-0.5 text-xs text-muted">{statusLabel}</p>
              </div>
              <StatusDot status={run?.status} active={isPhase1} />
            </div>
            {isPhase1 && run && (
              <div className="text-xs text-muted space-y-1">
                <p>Last run {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}</p>
                {run.stats && (
                  <p className="tabular-nums">
                    {String(run.stats.contacted ?? 0)} sent · {String(run.stats.newLeads ?? 0)} new leads · {String(run.stats.meetingsBooked ?? 0)} booked
                  </p>
                )}
              </div>
            )}
            {isPhase1 && <RunSalesAgentButton />}
          </div>
        )
      })}
    </section>
  )
}

function StatusDot({ status, active }: { status?: string; active?: boolean }) {
  if (!active) return <span className="h-2 w-2 rounded-full bg-zinc-600" />
  const cls =
    status === 'running' ? 'bg-amber-400 animate-pulse' :
    status === 'failed' ? 'bg-red-500' :
    status === 'completed' ? 'bg-emerald-500' :
    'bg-zinc-500'
  return <span className={`h-2 w-2 rounded-full ${cls}`} />
}
