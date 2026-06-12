'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createTask } from '../actions'

type AssignedAgent = 'ceo' | 'researcher' | 'cmo' | 'sales_rep' | 'dev' | 'data_analyst' | 'cto' | 'developer' | 'human'

const AGENTS: { key: AssignedAgent; label: string; subtitle: string; accent: string }[] = [
  { key: 'ceo', label: 'CEO', subtitle: 'Routes to the right specialist', accent: 'violet' },
  { key: 'researcher', label: 'Researcher', subtitle: 'Find leads, gather intel', accent: 'sky' },
  { key: 'cmo', label: 'CMO', subtitle: 'Content drafts, campaign angles', accent: 'fuchsia' },
  { key: 'sales_rep', label: 'Sales Rep', subtitle: 'Outreach, replies, booking', accent: 'amber' },
  { key: 'dev', label: 'Dev', subtitle: 'Code changes, draft PRs', accent: 'emerald' },
  { key: 'data_analyst', label: 'Data Analyst', subtitle: 'Metrics, telemetry, anomalies', accent: 'cyan' }
]

const ACCENT: Record<string, string> = {
  violet: 'border-violet-400/50 bg-violet-500/15 text-violet-200',
  sky: 'border-sky-400/50 bg-sky-500/15 text-sky-200',
  fuchsia: 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200',
  amber: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
  emerald: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200',
  cyan: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
}

export function NewTaskForm({ repos }: { repos: { id: string; fullName: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedAgent = (searchParams.get('agent') as AssignedAgent) || 'ceo'

  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    repoId: repos[0]?.id || '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    sourceLink: '',
    assignedAgent: preselectedAgent
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    startTransition(async () => {
      try {
        const r = await createTask({
          title: form.title,
          description: form.description,
          repoId: form.repoId || undefined,
          priority: form.priority,
          sourceLink: form.sourceLink || undefined,
          assignedAgent: form.assignedAgent
        })
        router.push(`/tasks/${r.id}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  const requiresRepo = form.assignedAgent === 'dev' || form.assignedAgent === 'cto' || form.assignedAgent === 'developer'

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-xs uppercase tracking-wider text-muted mb-2">Assign to</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AGENTS.map((a) => {
            const on = form.assignedAgent === a.key
            return (
              <button key={a.key} type="button"
                      onClick={() => setForm({ ...form, assignedAgent: a.key })}
                      className={`text-left rounded-lg border p-3 transition ${
                        on ? `${ACCENT[a.accent]} ring-1 ring-current/30`
                           : 'border-border bg-bg/30 text-muted hover:text-text hover:bg-bg/60'
                      }`}>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">{a.subtitle}</p>
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Title" required>
        <input className={cls} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
               placeholder="e.g. Fix race condition in webhook handler" />
      </Field>
      <Field label="Description">
        <textarea rows={5} className={cls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Be specific. Paste error logs, expected behavior, repro steps. For non-dev tasks, describe what 'done' looks like." />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={`Repo${requiresRepo ? '' : ' (optional)'}`} required={requiresRepo}>
          {repos.length ? (
            <select className={cls} value={form.repoId} onChange={e => setForm({ ...form, repoId: e.target.value })} required={requiresRepo}>
              <option value="">— No repo —</option>
              {repos.map(r => <option key={r.id} value={r.id}>{r.fullName}</option>)}
            </select>
          ) : (
            <p className="text-xs text-muted py-2">No repos synced. Click <span className="text-text">Sync GitHub repos</span> on the Tasks page first.</p>
          )}
        </Field>
        <Field label="Priority">
          <select className={cls} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as typeof form.priority })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
      </div>
      <Field label="Source link (Jira ticket, GitHub issue, etc.)">
        <input className={cls} value={form.sourceLink} onChange={e => setForm({ ...form, sourceLink: e.target.value })}
               placeholder="https://..." />
      </Field>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg/50">Cancel</button>
        <button type="submit" disabled={busy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {busy ? 'Creating…' : `Assign to ${AGENTS.find(a => a.key === form.assignedAgent)?.label}`}
        </button>
      </div>
    </form>
  )
}

const cls = 'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm'
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted mb-2">{label}{required && <span className="text-amber-300"> ·</span>}</label>
      {children}
    </div>
  )
}
