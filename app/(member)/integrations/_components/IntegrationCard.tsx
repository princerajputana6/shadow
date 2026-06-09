'use client'

type Integration = {
  key: string
  name: string
  description: string
  connected: boolean
  detail?: string
  connectAction: string
  disconnectAction: string
  icon: string
  requiredFor: string[]
  notConfigured?: boolean
}

const ICON_COLOR: Record<string, string> = {
  gmail: 'from-red-500/30 to-orange-500/30 ring-red-400/30',
  github: 'from-zinc-400/30 to-zinc-700/30 ring-zinc-400/30',
  bitbucket: 'from-blue-500/30 to-sky-700/30 ring-blue-400/30',
  jira: 'from-blue-400/30 to-indigo-700/30 ring-indigo-400/30',
  slack: 'from-fuchsia-500/30 to-purple-700/30 ring-fuchsia-400/30'
}

export function IntegrationCard({ integration: i }: { integration: Integration }) {
  function connect() {
    if (i.notConfigured) {
      alert(`${i.name} OAuth is not configured in the AgentOS environment. Ask your admin to set the OAuth client id/secret.`)
      return
    }
    window.location.href = i.connectAction
  }
  function disconnect() {
    if (!confirm(`Disconnect ${i.name}? Agents that depend on it will fail until reconnected.`)) return
    const f = document.createElement('form')
    f.method = 'POST'; f.action = i.disconnectAction
    document.body.appendChild(f); f.submit()
  }

  return (
    <article className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${ICON_COLOR[i.icon] || ICON_COLOR.github} ring-1 flex items-center justify-center`}>
          <span className="text-text/90 font-semibold">{i.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{i.name}</h3>
            {i.connected ? (
              <span className="text-[10px] uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20 px-2 py-0.5">
                connected
              </span>
            ) : i.notConfigured ? (
              <span className="text-[10px] uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/20 px-2 py-0.5">
                setup needed
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider rounded-full ring-1 ring-border text-muted/60 px-2 py-0.5">
                not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted leading-snug">{i.description}</p>
          {i.detail && <p className="mt-2 text-xs text-text/80">{i.detail}</p>}
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted/60">
            Required for: {i.requiredFor.join(', ')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {i.connected ? (
          <button onClick={disconnect}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
            Disconnect
          </button>
        ) : (
          <button onClick={connect} disabled={i.notConfigured}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-40 disabled:cursor-not-allowed">
            {i.notConfigured ? 'Awaiting OAuth config' : 'Connect'}
          </button>
        )}
        {i.connected && i.connectAction !== '/api/integrations/google/connect' && (
          <button onClick={connect}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-text">
            Reconnect
          </button>
        )}
      </div>
    </article>
  )
}
