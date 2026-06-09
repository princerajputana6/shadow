type Run = {
  agentName?: string
  status?: string
  startedAt?: string | Date
  stats?: Record<string, unknown>
}

export function CurrentDirectiveCard({ latestRun }: { latestRun: Run | null }) {
  if (!latestRun) {
    return (
      <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">● Current Directive</h2>
        <div className="rounded-xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 border border-cyan-500/10 p-4">
          <p className="text-base font-medium">No active directive</p>
          <p className="text-[11px] text-muted mt-1">Trigger an agent to populate the command line.</p>
        </div>
      </section>
    )
  }

  const agentLabel = (latestRun.agentName || '').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
  const stats = latestRun.stats || {}
  const summary = typeof stats.briefingSummary === 'string' ? stats.briefingSummary :
                  typeof stats.business === 'string' ? `Discovery for ${stats.business}` :
                  typeof stats.title === 'string' ? String(stats.title) :
                  'Operation in progress'

  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
      <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">● Current Directive</h2>
      <div className="rounded-xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 border border-cyan-500/10 p-4">
        <p className="text-base font-medium">{agentLabel} — {summary}</p>
        <p className="text-[11px] text-muted mt-1">
          {latestRun.startedAt && new Date(latestRun.startedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          {latestRun.status && ` · ${latestRun.status}`}
        </p>
      </div>
    </section>
  )
}
