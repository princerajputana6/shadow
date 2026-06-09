import type { AgentStatusRow } from '@/lib/agentRoster'

const ACCENT_GRAD: Record<string, string> = {
  violet: 'from-violet-500/30 to-violet-700/30',
  sky: 'from-sky-500/30 to-sky-700/30',
  orange: 'from-orange-500/30 to-orange-700/30',
  amber: 'from-amber-500/30 to-amber-700/30',
  emerald: 'from-emerald-500/30 to-emerald-700/30',
  fuchsia: 'from-fuchsia-500/30 to-fuchsia-700/30'
}
const ACCENT_RING: Record<string, string> = {
  violet: 'ring-violet-400/30',
  sky: 'ring-sky-400/30',
  orange: 'ring-orange-400/30',
  amber: 'ring-amber-400/30',
  emerald: 'ring-emerald-400/30',
  fuchsia: 'ring-fuchsia-400/30'
}

export function AgentChips({ roster }: { roster: AgentStatusRow[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {roster.map(a => (
        <div key={a.key}
             className={`group flex items-center gap-3 rounded-xl border border-border bg-surface/60 backdrop-blur px-3.5 py-2.5 min-w-[180px]
                         hover:ring-1 ${ACCENT_RING[a.accent]} transition`}>
          <div className={`relative h-8 w-8 rounded-lg bg-gradient-to-br ${ACCENT_GRAD[a.accent]} flex items-center justify-center
                           ring-1 ${ACCENT_RING[a.accent]}`}>
            <span className="text-text/80">{a.icon}</span>
            {a.status === 'working' && (
              <span className="absolute inset-0 rounded-lg animate-pulse ring-1 ring-emerald-400/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider">{a.name}</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted/70 truncate">{a.roleTitle}</div>
          </div>
          <StatusBadge status={a.status} />
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: AgentStatusRow['status'] }) {
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        working
      </span>
    )
  }
  if (status === 'failed') return <span className="text-[9px] uppercase tracking-wider text-red-300">failed</span>
  return <span className="text-[9px] uppercase tracking-wider text-muted/60">idle</span>
}
