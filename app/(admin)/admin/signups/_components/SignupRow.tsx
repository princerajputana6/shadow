'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setSignupStatus, convertSignupToCompany } from '../actions'

type Signup = {
  _id: string
  name: string
  email: string
  company: string
  phone?: string
  website?: string
  companySize: string
  interestedAgents: string[]
  budgetLabel: string
  message?: string
  status: 'new' | 'contacted' | 'converted' | 'rejected'
  createdAtRelative: string
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-amber-500/10 text-amber-300 ring-amber-400/30',
  contacted: 'bg-sky-500/10 text-sky-300 ring-sky-400/30',
  converted: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/30',
  rejected: 'bg-zinc-500/10 text-zinc-400 ring-zinc-400/20'
}

export function SignupRow({ signup: s }: { signup: Signup }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function update(status: 'new' | 'contacted' | 'converted' | 'rejected') {
    startTransition(async () => {
      await setSignupStatus(s._id, status)
    })
  }
  function convert() {
    if (!confirm(`Convert "${s.company}" into an onboarded company? This creates an Org + Owner User with a trial status, plus their picked agents.`)) return
    startTransition(async () => {
      try {
        const r = await convertSignupToCompany(s._id)
        setMsg(`Created. Org slug: ${r.slug}`)
        setTimeout(() => router.push(`/admin/companies/${r.id}`), 800)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <li className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold">{s.company}</h3>
            <span className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 ring-1 ${STATUS_STYLE[s.status]}`}>{s.status}</span>
            <span className="text-xs text-muted">{s.createdAtRelative}</span>
          </div>
          <p className="mt-1 text-sm">
            <span className="text-text">{s.name}</span>
            <span className="text-muted"> · </span>
            <a href={`mailto:${s.email}`} className="text-cyan-300 hover:underline">{s.email}</a>
            {s.phone && <><span className="text-muted"> · </span><span className="text-muted">{s.phone}</span></>}
            {s.website && <><span className="text-muted"> · </span><a href={s.website} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">site</a></>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-bg/60 border border-border px-2 py-0.5 text-muted">Size {s.companySize}</span>
            <span className="rounded-full bg-bg/60 border border-border px-2 py-0.5 text-muted">Budget {s.budgetLabel}</span>
            {s.interestedAgents.map(a => (
              <span key={a} className="rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 text-amber-200">{a}</span>
            ))}
          </div>
          {(s.message || open) && (
            <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="mt-3">
              <summary className="text-xs text-muted hover:text-text cursor-pointer">{open ? 'Hide' : 'Show'} message</summary>
              {s.message && <p className="mt-2 text-sm text-muted whitespace-pre-wrap leading-relaxed border-l-2 border-cyan-500/30 pl-3">{s.message}</p>}
            </details>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {s.status !== 'converted' && (
            <button onClick={convert} disabled={busy}
                    className="rounded-md bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
              Convert → Company
            </button>
          )}
          <div className="flex gap-1">
            {s.status !== 'contacted' && s.status !== 'converted' && (
              <button onClick={() => update('contacted')} disabled={busy}
                      className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/15 disabled:opacity-50">
                Mark contacted
              </button>
            )}
            {s.status !== 'rejected' && s.status !== 'converted' && (
              <button onClick={() => update('rejected')} disabled={busy}
                      className="rounded-md border border-border bg-bg/60 px-2 py-1 text-[11px] text-muted hover:text-red-300 disabled:opacity-50">
                Reject
              </button>
            )}
          </div>
        </div>
      </div>
      {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
    </li>
  )
}
