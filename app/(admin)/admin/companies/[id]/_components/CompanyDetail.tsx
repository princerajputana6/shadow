'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrg, updateAgentSubscription, deleteCompany } from '../../../actions'
import type { AgentKey } from '@/models/AgentSubscription'

type Org = {
  _id: string
  name: string
  contactEmail: string
  contactPhone?: string
  website?: string
  industry?: string
  status: 'active' | 'trial' | 'suspended' | 'cancelled'
  notes?: string
  trialEndsAt?: string | Date
  createdAt: string | Date
}

type AgentRow = {
  key: AgentKey
  name: string
  description: string
  defaultPriceINR: number
  sub: {
    enabled: boolean
    monthlyPriceINR: number
    status: 'active' | 'paused' | 'cancelled' | 'past_due'
  } | null
}

type Member = { role: 'owner' | 'admin' | 'member'; user?: { name?: string; email?: string } }

export function CompanyDetail({ org, agentRows, members }: { org: Org; agentRows: AgentRow[]; members: Member[] }) {
  const router = useRouter()
  const orgId = String(org._id)
  const [busy, startTransition] = useTransition()
  const [orgForm, setOrgForm] = useState({
    name: org.name,
    contactEmail: org.contactEmail,
    contactPhone: org.contactPhone || '',
    website: org.website || '',
    industry: org.industry || '',
    status: org.status,
    notes: org.notes || ''
  })

  function saveOrg() {
    startTransition(async () => {
      try { await updateOrg(orgId, orgForm); router.refresh() }
      catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    })
  }

  function destroy() {
    if (!confirm(`Delete ${org.name}? This removes the org, memberships, and subscriptions. Member users are NOT deleted.`)) return
    startTransition(async () => {
      try { await deleteCompany(orgId); router.push('/admin/companies') }
      catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    })
  }

  const monthly = agentRows.filter(r => r.sub?.enabled && r.sub.status === 'active').reduce((s, r) => s + (r.sub?.monthlyPriceINR || 0), 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Section title="Agents">
          <p className="text-xs text-muted mb-3">Toggle access and set per-agent pricing. Changes save immediately.</p>
          <ul className="divide-y divide-border">
            {agentRows.map(row => (
              <AgentRowCard key={row.key} row={row} orgId={orgId} onChanged={() => router.refresh()} />
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between text-sm border-t border-border pt-4">
            <span className="text-muted">Current monthly</span>
            <span className="text-xl font-semibold tabular-nums">
              ₹{monthly.toLocaleString('en-IN')}<span className="text-muted text-xs">/mo</span>
            </span>
          </div>
        </Section>

        <Section title="Company details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name"><input className={cls} value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} /></Field>
            <Field label="Contact email"><input className={cls} type="email" value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value })} /></Field>
            <Field label="Contact phone"><input className={cls} value={orgForm.contactPhone} onChange={e => setOrgForm({ ...orgForm, contactPhone: e.target.value })} /></Field>
            <Field label="Website"><input className={cls} value={orgForm.website} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} /></Field>
            <Field label="Industry"><input className={cls} value={orgForm.industry} onChange={e => setOrgForm({ ...orgForm, industry: e.target.value })} /></Field>
            <Field label="Status">
              <select className={cls} value={orgForm.status} onChange={e => setOrgForm({ ...orgForm, status: e.target.value as Org['status'] })}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Internal notes"><textarea rows={2} className={cls} value={orgForm.notes} onChange={e => setOrgForm({ ...orgForm, notes: e.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button onClick={destroy} disabled={busy}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
              Delete company
            </button>
            <button onClick={saveOrg} disabled={busy}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Section>
      </div>

      <aside className="space-y-6">
        <Section title="Members">
          {!members.length ? (
            <p className="text-sm text-muted">No memberships.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {members.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate">{m.user?.name || m.user?.email || '—'}</p>
                    <p className="text-[11px] text-muted truncate">{m.user?.email}</p>
                  </div>
                  <span className="text-xs rounded-full px-2 py-0.5 border border-border">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="System">
          <dl className="text-xs space-y-2">
            <Row label="Org id" value={orgId} mono />
            <Row label="Created" value={new Date(org.createdAt).toLocaleDateString('en-IN')} />
            {org.trialEndsAt && <Row label="Trial ends" value={new Date(org.trialEndsAt).toLocaleDateString('en-IN')} />}
          </dl>
        </Section>
      </aside>
    </div>
  )
}

function AgentRowCard({ row, orgId, onChanged }: { row: AgentRow; orgId: string; onChanged: () => void }) {
  const [busy, startTransition] = useTransition()
  const [enabled, setEnabled] = useState(row.sub?.enabled ?? false)
  const [price, setPrice] = useState(row.sub?.monthlyPriceINR ?? row.defaultPriceINR)
  const [status, setStatus] = useState(row.sub?.status ?? 'active')

  function commit(patch: { enabled?: boolean; monthlyPriceINR?: number; status?: typeof status }) {
    startTransition(async () => {
      try { await updateAgentSubscription(orgId, row.key, patch); onChanged() }
      catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    })
  }

  return (
    <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <label className="flex items-center gap-3 flex-1 cursor-pointer">
        <input type="checkbox" checked={enabled}
               onChange={e => { setEnabled(e.target.checked); commit({ enabled: e.target.checked }) }} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{row.name}</p>
          <p className="text-[11px] text-muted">{row.description}</p>
        </div>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">₹</span>
        <input type="number" min={0} className="w-24 rounded-md border border-border bg-bg px-2 py-1 text-sm text-right tabular-nums"
               value={price}
               onChange={e => setPrice(Number(e.target.value))}
               onBlur={() => price !== row.sub?.monthlyPriceINR && commit({ monthlyPriceINR: price })} />
        <span className="text-xs text-muted">/mo</span>
        <select className="rounded-md border border-border bg-bg px-2 py-1 text-xs"
                value={status}
                onChange={e => { const v = e.target.value as typeof status; setStatus(v); commit({ status: v }) }}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {busy && <span className="text-[11px] text-muted">…</span>}
    </li>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-muted mb-1">{label}</label>{children}</div>
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`${mono ? 'font-mono text-[11px]' : ''} text-right break-all`}>{value}</dd>
    </div>
  )
}
