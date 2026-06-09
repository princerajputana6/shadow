import { formatDistanceToNow } from 'date-fns'

type Run = {
  agentName: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string | Date
  errorMessage?: string
  stats?: Record<string, unknown>
}

type Props = {
  totalRuns: number
  totalFailures: number
  runs7d: number
  failures7d: number
  tokensEstimate: number
  integrations: { google: boolean; github: boolean; bitbucket: boolean; jira: boolean }
  latestRuns: Run[]
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export function CompanyUsageRow({ totalRuns, totalFailures, runs7d, failures7d, tokensEstimate, integrations, latestRuns }: Props) {
  const failRate = totalRuns > 0 ? Math.round((totalFailures / totalRuns) * 100) : 0

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total runs" value={compact(totalRuns)} sub={`${runs7d} in last 7d`} />
        <Stat label="Tokens used (est)" value={compact(tokensEstimate)} sub="cumulative" />
        <Stat label="Failure rate" value={`${failRate}%`}
              sub={`${totalFailures} all-time · ${failures7d} (7d)`}
              warn={failRate > 5} />
        <Stat label="Health" value={failures7d === 0 && totalRuns > 0 ? 'Good' : failures7d > 0 ? 'Watch' : 'Idle'}
              sub={failures7d > 0 ? 'recent failures' : 'no recent issues'}
              warn={failures7d > 0} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">Integrations</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <IntegrationItem name="Google (Gmail + Calendar)" connected={integrations.google} />
            <IntegrationItem name="GitHub" connected={integrations.github} />
            <IntegrationItem name="Bitbucket" connected={integrations.bitbucket} />
            <IntegrationItem name="Jira" connected={integrations.jira} />
          </ul>
          <p className="text-[10px] text-muted/60 mt-3">Connections live on the owner's user account. Status updates when they connect from /integrations on their dashboard.</p>
        </div>

        <div className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">Latest agent runs</h3>
          {latestRuns.length === 0 ? (
            <p className="text-xs text-muted">No runs yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {latestRuns.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-cyan-500/5 pb-1.5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-text capitalize">{r.agentName.replace('_', ' ')}</p>
                    {r.errorMessage && <p className="text-red-300/80 truncate">{r.errorMessage.slice(0, 80)}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                      r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' :
                      r.status === 'failed' ? 'bg-red-500/10 text-red-300' :
                      'bg-amber-500/10 text-amber-300'
                    }`}>{r.status}</span>
                    <span className="text-muted/70 whitespace-nowrap">{formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-surface/60 backdrop-blur p-4
                     ${warn ? 'border-amber-500/30 ring-1 ring-amber-400/10' : 'border-cyan-500/10'}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-mono tabular-nums ${warn ? 'text-amber-300' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted/70 mt-0.5">{sub}</p>}
    </div>
  )
}

function IntegrationItem({ name, connected }: { name: string; connected: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg/30 px-2.5 py-2">
      <span className="truncate">{name}</span>
      {connected ? (
        <span className="text-[9px] uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20 px-1.5 py-0.5">connected</span>
      ) : (
        <span className="text-[9px] uppercase tracking-wider rounded-full ring-1 ring-border text-muted/60 px-1.5 py-0.5">not connected</span>
      )}
    </li>
  )
}
