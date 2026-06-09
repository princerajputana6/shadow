import { formatDistanceToNow } from 'date-fns'

type Run = {
  _id: string
  agentName: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string | Date
  completedAt?: string | Date
  errorMessage?: string
  stats?: Record<string, unknown>
}

const AGENT_LABEL: Record<string, string> = {
  sales_finder: 'Sales Rep',
  social_media: 'CMO',
  cto: 'Data Analyst',
  developer: 'Dev'
}

const STATUS_COLOR: Record<string, string> = {
  running: 'text-amber-300 bg-amber-500/10',
  completed: 'text-emerald-300 bg-emerald-500/10',
  failed: 'text-red-300 bg-red-500/10'
}

export function AgentLog({ runs }: { runs: Run[] }) {
  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/10">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">Agent Log</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted">last 50</span>
      </div>
      {!runs.length ? (
        <p className="p-6 text-sm text-muted text-center">No runs yet.</p>
      ) : (
        <ul className="divide-y divide-cyan-500/5 text-sm">
          {runs.map(r => {
            const label = AGENT_LABEL[r.agentName] || r.agentName
            const mode = typeof r.stats?.mode === 'string' ? ` · ${r.stats.mode}` : ''
            const summary = typeof r.stats?.business === 'string' ? r.stats.business :
                            typeof r.stats?.briefingSummary === 'string' ? r.stats.briefingSummary.slice(0, 80) :
                            r.errorMessage?.slice(0, 80) || ''
            return (
              <li key={String(r._id)} className="px-5 py-2.5 flex items-center gap-4 font-mono text-xs">
                <span className="text-muted shrink-0 w-20">
                  {formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}
                </span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 ${STATUS_COLOR[r.status] || ''}`}>
                  {r.status}
                </span>
                <span className="text-text/90 shrink-0 w-32 truncate uppercase tracking-wider text-[10px]">{label}{mode}</span>
                <span className="text-muted/80 truncate flex-1">{summary}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
