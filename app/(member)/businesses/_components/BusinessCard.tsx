'use client'

import { useState, useTransition } from 'react'
import { updateBusiness, deleteBusiness, runDiscoveryForBusiness } from '../actions'
import { formatDistanceToNow } from 'date-fns'

type Business = {
  _id: string
  name: string
  website: string
  slug: string
  description?: string
  services?: string[]
  idealCustomerProfile?: string
  searchKeywords?: string[]
  excludeKeywords?: string[]
  regions?: string[]
  active: boolean
  lastDiscoveryAt?: string | Date
  prospectCount?: number
}

export function BusinessCard({ business }: { business: Business }) {
  const id = String(business._id)
  const [editing, setEditing] = useState(false)
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: business.name,
    description: business.description || '',
    idealCustomerProfile: business.idealCustomerProfile || '',
    services: (business.services || []).join(', '),
    searchKeywords: (business.searchKeywords || []).join('\n'),
    excludeKeywords: (business.excludeKeywords || []).join(', '),
    regions: (business.regions || []).join(', ')
  })

  function save() {
    setMsg(null)
    startTransition(async () => {
      try {
        await updateBusiness(id, {
          name: form.name.trim(),
          description: form.description.trim(),
          idealCustomerProfile: form.idealCustomerProfile.trim(),
          services: form.services.split(',').map(s => s.trim()).filter(Boolean),
          searchKeywords: form.searchKeywords.split('\n').map(s => s.trim()).filter(Boolean),
          excludeKeywords: form.excludeKeywords.split(',').map(s => s.trim()).filter(Boolean),
          regions: form.regions.split(',').map(s => s.trim()).filter(Boolean)
        })
        setEditing(false); setMsg('Saved.')
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  function runDiscovery() {
    setMsg(null)
    startTransition(async () => {
      try { await runDiscoveryForBusiness(id); setMsg('Discovery started — check /discovery in 1–2 min.') }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }

  function remove() {
    if (!confirm(`Delete "${business.name}"? Prospects keep their records but lose the business link.`)) return
    startTransition(async () => {
      try { await deleteBusiness(id) } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{business.name}</h3>
          <a href={business.website} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline truncate block max-w-md">
            {business.website}
          </a>
          <p className="mt-1 text-[11px] text-muted">
            Shadow slug: <code className="text-text">{business.slug}</code>
            {business.lastDiscoveryAt && <> · last discovery {formatDistanceToNow(new Date(business.lastDiscoveryAt), { addSuffix: true })}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={runDiscovery} disabled={busy}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
            Run discovery
          </button>
          <button onClick={() => setEditing(v => !v)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-border/30">
            {editing ? 'Cancel' : 'Edit profile'}
          </button>
        </div>
      </header>

      {!editing ? (
        <div className="space-y-2 text-sm">
          {business.description && <p>{business.description}</p>}
          {business.idealCustomerProfile && (
            <p className="text-muted"><span className="text-text font-medium">ICP:</span> {business.idealCustomerProfile}</p>
          )}
          {!!business.services?.length && (
            <p className="text-muted"><span className="text-text font-medium">Services:</span> {business.services.join(', ')}</p>
          )}
          {!!business.searchKeywords?.length && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer text-text">Search keywords ({business.searchKeywords.length})</summary>
              <ul className="mt-2 space-y-1">
                {business.searchKeywords.map((k, i) => <li key={i}>· {k}</li>)}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <Field label="Name"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={2} className={inputCls} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Ideal customer (who buys from you)"><textarea rows={2} className={inputCls} value={form.idealCustomerProfile} onChange={e => setForm({ ...form, idealCustomerProfile: e.target.value })} /></Field>
          <Field label="Services (comma-separated)"><input className={inputCls} value={form.services} onChange={e => setForm({ ...form, services: e.target.value })} /></Field>
          <Field label="Search keywords (one per line — buyer-intent phrases)">
            <textarea rows={6} className={inputCls} value={form.searchKeywords} onChange={e => setForm({ ...form, searchKeywords: e.target.value })} />
          </Field>
          <Field label="Exclude keywords (signals of a competitor)"><input className={inputCls} value={form.excludeKeywords} onChange={e => setForm({ ...form, excludeKeywords: e.target.value })} /></Field>
          <Field label="Regions (comma-separated)"><input className={inputCls} value={form.regions} onChange={e => setForm({ ...form, regions: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <button onClick={remove} disabled={busy}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
              Delete
            </button>
            <button onClick={save} disabled={busy}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50">
              Save changes
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-muted">{msg}</p>}
    </article>
  )
}

const inputCls = 'w-full rounded-md border border-border bg-bg px-3 py-1.5 text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      {children}
    </div>
  )
}
