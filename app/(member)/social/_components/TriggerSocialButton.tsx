'use client'

import { useState, useTransition } from 'react'
import { triggerSocialDraft } from '../actions'

export function TriggerSocialButton() {
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  function go() {
    setMsg(null)
    startTransition(async () => {
      try { await triggerSocialDraft(); setMsg('Drafting — refresh in 30s.') }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }
  return (
    <div className="text-right">
      <button onClick={go} disabled={busy}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
        {busy ? 'Drafting…' : 'Draft new posts'}
      </button>
      {msg && <p className="mt-1 text-[11px] text-muted">{msg}</p>}
    </div>
  )
}
