'use client'

import { useState } from 'react'

export function GithubConnection({ connected, login, connectedAt, scope }: {
  connected: boolean; login?: string; connectedAt?: string; scope?: string
}) {
  const [busy, setBusy] = useState(false)

  function connect() {
    setBusy(true)
    window.location.href = '/api/integrations/github/start'
  }
  async function disconnect() {
    if (!confirm('Disconnect GitHub? The Developer agent will lose repo access.')) return
    setBusy(true)
    const f = document.createElement('form')
    f.method = 'POST'; f.action = '/api/integrations/github/disconnect'
    document.body.appendChild(f); f.submit()
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Connect a GitHub account so the Developer agent can read repos and open draft PRs against them.
          Requires <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code> in env (create a GitHub OAuth App at github.com/settings/applications/new).
        </p>
        <button onClick={connect} disabled={busy}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
          {busy ? 'Redirecting…' : 'Connect GitHub'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">Connected as <code className="text-text">{login || 'unknown'}</code></p>
          {connectedAt && <p className="text-[11px] text-muted">{new Date(connectedAt).toLocaleString('en-IN')}</p>}
        </div>
        <span className="text-xs rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-400">Active</span>
      </div>
      {scope && <p className="text-xs text-muted">Scopes: <code>{scope}</code></p>}
      <button onClick={disconnect} disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50">
        Disconnect
      </button>
    </div>
  )
}
