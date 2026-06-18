'use client'

import { useRef, useState, useTransition } from 'react'
import { createMemory } from '../actions'
import { MEMORY_TYPES } from '@/models/Memory'

const TYPE_LABEL: Record<string, string> = {
  short_term: 'Short-term', long_term: 'Long-term', episodic: 'Episodic', semantic: 'Semantic'
}

export function MemoryComposer() {
  const [open, setOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(form: FormData) {
    setMsg(null)
    startTransition(async () => {
      try {
        await createMemory(form)
        formRef.current?.reset()
        setMsg('Saved.')
        setTimeout(() => setMsg(null), 1500)
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-border bg-surface/40 px-4 py-3 text-sm text-muted hover:text-text hover:border-cyan-500/30 transition text-left">
        + Add a memory…
      </button>
    )
  }

  return (
    <form ref={formRef} action={onSubmit}
          className="rounded-2xl border border-cyan-500/20 bg-surface/70 backdrop-blur p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          name="key" required placeholder="Label — e.g. Company revenue"
          className="sm:col-span-1 rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40" />
        <input
          name="value" required placeholder="Value — e.g. ₹5Cr ARR as of 2026"
          className="sm:col-span-2 rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select name="type" defaultValue="long_term"
                className="rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40">
          {MEMORY_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted">
          Importance
          <select name="importance" defaultValue="3"
                  className="rounded-lg bg-bg/50 border border-border px-2 py-2 text-sm outline-none focus:border-cyan-500/40">
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <input
          name="tags" placeholder="tags, comma, separated"
          className="flex-1 min-w-[140px] rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-black disabled:opacity-50">
          {busy ? 'Saving…' : 'Save memory'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setMsg(null) }}
                className="text-xs text-muted hover:text-text">Cancel</button>
        {msg && <span className="text-[11px] text-muted">{msg}</span>}
      </div>
    </form>
  )
}
