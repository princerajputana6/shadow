'use client'

import { useState, useTransition } from 'react'
import { triggerEnrichment } from '../actions'

export function EnrichButton() {
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  function go() {
    setMsg(null)
    startTransition(async () => {
      try { await triggerEnrichment(); setMsg('Enrichment started — refresh in 1–2 min.') }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }
  return (
    <div className="text-right">
      <button onClick={go} disabled={busy}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs hover:bg-border/30 disabled:opacity-50">
        {busy ? 'Enriching…' : 'Find emails (Hunter.io)'}
      </button>
      {msg && <p className="mt-1 text-[11px] text-muted">{msg}</p>}
    </div>
  )
}
