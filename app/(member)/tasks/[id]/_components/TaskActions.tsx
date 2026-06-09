'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { triggerCto, triggerDeveloper } from '../../actions'

export function TaskActions({ taskId, status, hasRepo, hasPlan }: {
  taskId: string; status: string; hasRepo: boolean; hasPlan: boolean
}) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function go(fn: () => Promise<void>, label: string) {
    setMsg(null)
    startTransition(async () => {
      try { await fn(); setMsg(`${label} started — refresh in 30s.`); setTimeout(() => router.refresh(), 30_000) }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {(status === 'backlog' || status === 'triaging') && (
          <button onClick={() => go(() => triggerCto(taskId), 'CTO')}
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
            Run CTO triage
          </button>
        )}
        {hasPlan && hasRepo && (status === 'in_progress' || status === 'triaging' || status === 'pr_open') && (
          <button onClick={() => go(() => triggerDeveloper(taskId), 'Developer')}
                  disabled={busy}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
            {status === 'pr_open' ? 'Rerun Developer' : 'Run Developer'}
          </button>
        )}
      </div>
      {msg && <p className="text-[11px] text-muted">{msg}</p>}
    </div>
  )
}
