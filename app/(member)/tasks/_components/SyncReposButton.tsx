'use client'

import { useState, useTransition } from 'react'
import { syncRepos } from '../actions'

export function SyncReposButton({ hasRepos }: { hasRepos: boolean }) {
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  function go() {
    setMsg(null)
    startTransition(async () => {
      try { const r = await syncRepos(); setMsg(`Synced ${r.synced} repos.`) }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }
  return (
    <div className="text-right">
      <button onClick={go} disabled={busy}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm hover:bg-border/30 disabled:opacity-50">
        {busy ? 'Syncing…' : hasRepos ? 'Re-sync repos' : 'Sync GitHub repos'}
      </button>
      {msg && <p className="mt-1 text-[11px] text-muted">{msg}</p>}
    </div>
  )
}
