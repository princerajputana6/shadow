'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTask } from '../actions'

export function NewTaskForm({ repos }: { repos: { id: string; fullName: string }[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    repoId: repos[0]?.id || '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    sourceLink: ''
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
          sourceLink: form.sourceLink || undefined
        })
        router.push(`/tasks/${r.id}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" required>
        <input className={cls} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
               placeholder="e.g. Fix race condition in webhook handler" />
      </Field>
      <Field label="Description">
        <textarea rows={5} className={cls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Be specific — paste error logs, expected behavior, repro steps. The more detail, the better the PR." />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Repo">
          {repos.length ? (
            <select className={cls} value={form.repoId} onChange={e => setForm({ ...form, repoId: e.target.value })}>
              <option value="">— No repo (planning only) —</option>
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
        <input className={cls} value={form.sourceLink} onChange={e => setForm({ ...form, sourceLink: e.target.value })} />
      </Field>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg/50">Cancel</button>
        <button type="submit" disabled={busy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {busy ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </form>
  )
}

const cls = 'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm'
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}{required && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  )
}
