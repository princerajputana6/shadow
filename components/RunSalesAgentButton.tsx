'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RunSalesAgentButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()

  async function trigger() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/agents/sales/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to start')
      setMsg('Agent started — refresh in 1–2 min for results.')
      setTimeout(() => router.refresh(), 60_000)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to start')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={trigger} disabled={busy}
        className="rounded-md border border-border bg-bg px-2 py-1 text-xs hover:bg-border/30 disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Run now'}
      </button>
      {msg && <p className="text-[11px] text-muted">{msg}</p>}
    </div>
  )
}
