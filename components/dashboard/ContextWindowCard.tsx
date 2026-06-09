import type { AgentStatusRow } from '@/lib/agentRoster'

type AgentLoad = { name: string; runs: number; failed: number }

export function ContextWindowCard({ roster, loads }: { roster: AgentStatusRow[]; loads: AgentLoad[] }) {
  const maxRuns = Math.max(1, ...loads.map(l => l.runs))
  const totalRuns = loads.reduce((s, l) => s + l.runs, 0)
  const totalFailed = loads.reduce((s, l) => s + l.failed, 0)
  const lastFailedNote = totalFailed > 0
    ? `${totalFailed} failed · last: see Tasks for details`
    : 'No recent failures'

  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5 space-y-4">
      <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">▦ Context Window</h2>
      <div className="space-y-3">
        {roster.slice(0, 6).map(role => {
          const load = loads.find(l => l.name === role.backendAgentName) || { runs: 0, failed: 0 }
          const pct = (load.runs / maxRuns) * 100
          return (
            <div key={role.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="uppercase tracking-wider">{role.name}</span>
                <span className="font-mono tabular-nums text-muted">{load.runs} tasks</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg/60 overflow-hidden">
                <div className={`h-full bg-gradient-to-r from-cyan-400/50 to-violet-400/50`}
                     style={{ width: `${Math.max(2, pct)}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-muted pt-2 border-t border-cyan-500/10">{lastFailedNote}</p>
    </section>
  )
}
