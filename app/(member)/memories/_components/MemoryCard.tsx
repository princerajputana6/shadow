'use client'

import { useState, useTransition } from 'react'
import { updateMemory, deleteMemory, togglePin, toggleArchive } from '../actions'
import { MEMORY_TYPES, type MemoryType } from '@/models/Memory'

export type MemoryView = {
  id: string
  key: string
  value: string
  type: MemoryType
  importance: number
  tags: string[]
  pinned: boolean
  archived: boolean
  updatedAt: string
}

const TYPE_STYLE: Record<MemoryType, { label: string; cls: string }> = {
  short_term: { label: 'Short-term', cls: 'bg-cyan-500/10 text-cyan-300 ring-cyan-500/20' },
  long_term: { label: 'Long-term', cls: 'bg-violet-500/10 text-violet-300 ring-violet-500/20' },
  episodic: { label: 'Episodic', cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/20' },
  semantic: { label: 'Semantic', cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' }
}

export function MemoryCard({ memory }: { memory: MemoryView }) {
  const [editing, setEditing] = useState(false)
  const [busy, startTransition] = useTransition()
  const t = TYPE_STYLE[memory.type]

  function act(fn: () => Promise<void>) {
    startTransition(async () => { try { await fn() } catch { /* surfaced by revalidate */ } })
  }

  if (editing) {
    return (
      <form
        action={async (form) => {
          await updateMemory(memory.id, form)
          setEditing(false)
        }}
        className="rounded-2xl border border-cyan-500/30 bg-surface/80 backdrop-blur p-4 space-y-3">
        <input name="key" defaultValue={memory.key} required
               className="w-full rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40" />
        <textarea name="value" defaultValue={memory.value} required rows={3}
                  className="w-full rounded-lg bg-bg/50 border border-border px-3 py-2 text-sm outline-none focus:border-cyan-500/40 resize-y" />
        <div className="flex flex-wrap items-center gap-2">
          <select name="type" defaultValue={memory.type}
                  className="rounded-lg bg-bg/50 border border-border px-2 py-1.5 text-xs outline-none focus:border-cyan-500/40">
            {MEMORY_TYPES.map(mt => <option key={mt} value={mt}>{TYPE_STYLE[mt].label}</option>)}
          </select>
          <select name="importance" defaultValue={String(memory.importance)}
                  className="rounded-lg bg-bg/50 border border-border px-2 py-1.5 text-xs outline-none focus:border-cyan-500/40">
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>★ {n}</option>)}
          </select>
          <input name="tags" defaultValue={memory.tags.join(', ')} placeholder="tags"
                 className="flex-1 min-w-[120px] rounded-lg bg-bg/50 border border-border px-3 py-1.5 text-xs outline-none focus:border-cyan-500/40" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black">Save</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:text-text">Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div className={`group relative rounded-2xl border bg-surface/60 backdrop-blur p-4 transition
      ${memory.pinned ? 'border-cyan-500/30 ring-1 ring-cyan-500/10' : 'border-border'}
      ${busy ? 'opacity-50' : 'hover:border-cyan-500/20'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider ring-1 ${t.cls}`}>
            {t.label}
          </span>
          {memory.pinned && <span className="text-[11px] text-cyan-300" title="Pinned">★</span>}
        </div>
        <div className="flex items-center gap-0.5 text-[10px]" title={`Importance ${memory.importance}/5`}>
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={n <= memory.importance ? 'text-accent' : 'text-border'}>●</span>
          ))}
        </div>
      </div>

      <h3 className="mt-2 text-sm font-medium text-text truncate">{memory.key}</h3>
      <p className="mt-1 text-sm text-muted leading-snug whitespace-pre-wrap">{memory.value}</p>

      {memory.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memory.tags.map(tag => (
            <span key={tag} className="rounded px-1.5 py-0.5 text-[10px] bg-bg/50 text-muted/80 ring-1 ring-border">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted/80 opacity-0 group-hover:opacity-100 transition">
        <button onClick={() => act(() => togglePin(memory.id))} className="hover:text-cyan-300">
          {memory.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button onClick={() => setEditing(true)} className="hover:text-text">Edit</button>
        <button onClick={() => act(() => toggleArchive(memory.id))} className="hover:text-amber-300">
          {memory.archived ? 'Restore' : 'Archive'}
        </button>
        <button onClick={() => act(() => deleteMemory(memory.id))} className="hover:text-red-400 ml-auto">
          Delete
        </button>
      </div>
    </div>
  )
}
