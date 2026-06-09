'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCompany } from '../../actions'
import type { AgentKey } from '@/models/AgentSubscription'

type CatalogItem = { key: AgentKey; name: string; description: string; defaultPriceINR: number }

export function NewCompanyForm({ agents }: { agents: CatalogItem[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    website: '',
    industry: '',
    contactPhone: '',
    status: 'trial' as 'trial' | 'active'
  })
  const [enabled, setEnabled] = useState<Set<AgentKey>>(new Set())

  function toggle(k: AgentKey) {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    startTransition(async () => {
      try {
        const r = await createCompany({
          ...form,
          enabledAgents: Array.from(enabled)
        })
        router.push(`/admin/companies/${r.id}`)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  const monthlyTotal = agents.filter(a => enabled.has(a.key)).reduce((s, a) => s + a.defaultPriceINR, 0)

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Company">
        <Grid>
          <Field label="Company name" required>
            <input className={cls} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Website">
            <input className={cls} type="url" placeholder="https://" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          </Field>
          <Field label="Industry">
            <input className={cls} value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
          </Field>
          <Field label="Initial status">
            <select className={cls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'trial' | 'active' })}>
              <option value="trial">14-day trial</option>
              <option value="active">Active (paying)</option>
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Owner user">
        <Grid>
          <Field label="Full name">
            <input className={cls} value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input className={cls} type="email" required value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} />
          </Field>
          <Field label="Initial password (optional)">
            <input className={cls} type="text" placeholder="leave blank for Google-only login" value={form.ownerPassword} onChange={e => setForm({ ...form, ownerPassword: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={cls} value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
          </Field>
        </Grid>
      </Section>

      <Section title="Agents">
        <p className="text-xs text-muted mb-3">Tick the agents this company is paying for. Pricing uses catalog defaults; you can fine-tune on the company detail page.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map(a => (
            <label key={a.key} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition
              ${enabled.has(a.key) ? 'border-accent bg-accent/5' : 'border-border bg-bg/30'}`}>
              <input type="checkbox" className="mt-1" checked={enabled.has(a.key)} onChange={() => toggle(a.key)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs tabular-nums">₹{a.defaultPriceINR.toLocaleString('en-IN')}/mo</p>
                </div>
                <p className="text-xs text-muted">{a.description}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-baseline justify-between text-sm">
          <span className="text-muted">Monthly total at default prices</span>
          <span className="text-lg font-semibold tabular-nums">
            ₹{monthlyTotal.toLocaleString('en-IN')}<span className="text-muted text-xs">/mo</span>
          </span>
        </div>
      </Section>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => router.back()}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg/50">
          Cancel
        </button>
        <button type="submit" disabled={busy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {busy ? 'Creating…' : 'Create company'}
        </button>
      </div>
    </form>
  )
}

const cls = 'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {children}
    </section>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}{required && <span className="text-red-400"> *</span>}</label>
      {children}
    </div>
  )
}
