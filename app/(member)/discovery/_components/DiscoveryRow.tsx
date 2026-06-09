'use client'

import { useState, useTransition } from 'react'
import { approveProspect, rejectProspect } from '../actions'

type Prospect = {
  _id: string
  name?: string
  email: string
  company?: string
  discoveryNotes?: string
  discoverySignal?: string
  discoveryUrl?: string
  createdAt: Date
}

export function DiscoveryRow({ prospect }: { prospect: Prospect }) {
  const id = String(prospect._id)
  const placeholder = prospect.email.endsWith('@placeholder.invalid')
  const [email, setEmail] = useState(placeholder ? '' : prospect.email)
  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  function approve() {
    setErr(null)
    startTransition(async () => {
      try {
        await approveProspect(id, email)
        setDone('approved')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  function reject() {
    startTransition(async () => {
      try {
        await rejectProspect(id)
        setDone('rejected')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  if (done) {
    return (
      <li className="rounded-2xl border border-border bg-surface/50 p-4 text-xs text-muted">
        {done === 'approved' ? '✓ Moved to outreach queue.' : '✕ Dropped.'}
      </li>
    )
  }

  return (
    <li className="rounded-2xl border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">
            {prospect.company || 'Unknown company'}
            {prospect.name && <span className="text-muted"> · {prospect.name}</span>}
          </p>
          {prospect.discoverySignal && (
            <p className="mt-1 text-xs text-emerald-400">Signal: {prospect.discoverySignal}</p>
          )}
          {prospect.discoveryNotes && (
            <p className="mt-1 text-sm text-muted">{prospect.discoveryNotes}</p>
          )}
          {prospect.discoveryUrl && (
            <a href={prospect.discoveryUrl} target="_blank" rel="noreferrer"
               className="mt-1 inline-block text-xs text-accent hover:underline truncate max-w-md">
              {prospect.discoveryUrl}
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          placeholder={placeholder ? 'Add an email before approving…' : prospect.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[240px] rounded-md border border-border bg-bg px-3 py-1.5 text-sm"
        />
        <button onClick={approve} disabled={busy}
                className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50">
          Approve → outreach
        </button>
        <button onClick={reject} disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-text disabled:opacity-50">
          Reject
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </li>
  )
}
