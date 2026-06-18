'use client'

import { useRouter } from 'next/navigation'
import { MEMORY_TYPES, type MemoryType } from '@/models/Memory'

const TYPE_LABEL: Record<string, string> = {
  short_term: 'Short-term', long_term: 'Long-term', episodic: 'Episodic', semantic: 'Semantic'
}

export function MemoryFilters({ q, type, archived, archivedTotal }: {
  q: string
  type: MemoryType | 'all'
  archived: boolean
  archivedTotal: number
}) {
  const router = useRouter()

  function go(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams()
    const next = { q, type: type === 'all' ? undefined : type, view: archived ? 'archived' : undefined, ...params }
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v)
    const qs = sp.toString()
    router.push(qs ? `/memories?${qs}` : '/memories')
  }

  const tabs: { key: MemoryType | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    ...MEMORY_TYPES.map((t) => ({ key: t, label: TYPE_LABEL[t] }))
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = new FormData(e.currentTarget).get('q')
          go({ q: (String(v || '').trim() || undefined) })
        }}
        className="flex-1 min-w-[200px]">
        <input
          name="q" defaultValue={q} placeholder="Search memories…"
          className="w-full rounded-lg bg-surface/60 border border-border px-3 py-1.5 text-sm outline-none focus:border-cyan-500/40" />
      </form>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/60 p-0.5">
        {tabs.map((t) => {
          const active = type === t.key
          return (
            <button key={t.key} onClick={() => go({ type: t.key === 'all' ? undefined : t.key })}
                    className={`rounded-md px-2.5 py-1 text-xs transition
                      ${active ? 'bg-cyan-500/15 text-cyan-200' : 'text-muted hover:text-text'}`}>
              {t.label}
            </button>
          )
        })}
      </div>

      <button onClick={() => go({ view: archived ? undefined : 'archived' })}
              className={`rounded-lg px-3 py-1.5 text-xs transition border
                ${archived
                  ? 'bg-amber-500/10 text-amber-200 border-amber-500/30'
                  : 'text-muted hover:text-text border-border bg-surface/60'}`}>
        {archived ? '← Active' : `Archived${archivedTotal ? ` (${archivedTotal})` : ''}`}
      </button>
    </div>
  )
}
