type Props = {
  integrity: number      // 0-100
  agentCalls: number
  messages: number
  tokensIn: number
  errors: number
}

export function TelemetryRow({ integrity, agentCalls, messages, tokensIn, errors }: Props) {
  const cells = [
    { label: 'Integrity', value: `${integrity}%`, sub: integrity >= 90 ? 'nominal' : 'degraded', good: integrity >= 90 },
    { label: 'Agent Calls', value: agentCalls.toLocaleString('en-IN'), sub: '24h' },
    { label: 'Messages', value: messages.toLocaleString('en-IN'), sub: 'cumulative' },
    { label: 'Tokens In', value: tokensIn.toLocaleString('en-IN'), sub: 'cumulative' },
    { label: 'Errors', value: errors.toString(), sub: errors === 0 ? 'clean' : 'review', good: errors === 0 }
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cells.map(c => (
        <div key={c.label}
             className="rounded-xl border border-cyan-500/10 bg-bg/40 backdrop-blur px-3.5 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{c.label}</p>
          <p className={`mt-0.5 text-xl font-mono tabular-nums ${c.good === false ? 'text-amber-300' : ''}`}>
            {c.value}
          </p>
          <p className="text-[10px] text-muted/60 uppercase tracking-wider">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
