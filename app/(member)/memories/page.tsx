import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Memory, { MEMORY_TYPES, type MemoryType } from '@/models/Memory'
import { MemoryComposer } from './_components/MemoryComposer'
import { MemoryFilters } from './_components/MemoryFilters'
import { MemoryCard, type MemoryView } from './_components/MemoryCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TYPE_META: Record<MemoryType, { label: string }> = {
  short_term: { label: 'Short-term' },
  long_term: { label: 'Long-term' },
  episodic: { label: 'Episodic' },
  semantic: { label: 'Semantic' }
}

export default async function MemoriesPage({
  searchParams
}: {
  searchParams: { q?: string; type?: string; view?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const q = (searchParams.q || '').trim()
  const typeFilter = (MEMORY_TYPES as string[]).includes(searchParams.type || '')
    ? (searchParams.type as MemoryType)
    : 'all'
  const archived = searchParams.view === 'archived'

  await connectDB()
  const filter: Record<string, unknown> = { userId, archived }
  if (typeFilter !== 'all') filter.type = typeFilter
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ key: rx }, { value: rx }, { tags: rx }]
  }

  const [rows, counts] = await Promise.all([
    Memory.find(filter).sort({ pinned: -1, importance: -1, updatedAt: -1 }).limit(200).lean(),
    Memory.aggregate([
      { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId) } },
      { $group: { _id: { type: '$type', archived: '$archived' }, n: { $sum: 1 } } }
    ])
  ])

  const memories: MemoryView[] = rows.map((m) => ({
    id: String(m._id),
    key: m.key,
    value: m.value,
    type: m.type,
    importance: m.importance,
    tags: m.tags || [],
    pinned: !!m.pinned,
    archived: !!m.archived,
    updatedAt: new Date(m.updatedAt as Date).toISOString()
  }))

  const activeTotal = counts.filter(c => !c._id.archived).reduce((a, c) => a + c.n, 0)
  const archivedTotal = counts.filter(c => c._id.archived).reduce((a, c) => a + c.n, 0)
  const byType = (t: MemoryType) =>
    counts.filter(c => c._id.type === t && !c._id.archived).reduce((a, c) => a + c.n, 0)

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
        <p className="text-sm text-muted max-w-2xl">
          What Shadow remembers about you and your business. Pinned and high-importance
          memories are retrieved first and injected into every chat.
        </p>
      </header>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Active" value={activeTotal} accent="text-cyan-300" />
        {MEMORY_TYPES.map((t) => (
          <Stat key={t} label={TYPE_META[t].label} value={byType(t)} />
        ))}
      </div>

      <MemoryComposer />

      <MemoryFilters q={q} type={typeFilter} archived={archived} archivedTotal={archivedTotal} />

      {!memories.length ? (
        <div className="rounded-2xl border border-border bg-surface/60 p-8 text-center text-sm text-muted">
          {q || typeFilter !== 'all'
            ? 'No memories match this filter.'
            : archived
              ? 'No archived memories.'
              : 'No memories yet. Add one above — e.g. “Company revenue → ₹5Cr ARR (2026)”.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memories.map((m) => <MemoryCard key={m.id} memory={m} />)}
        </div>
      )}
    </main>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 backdrop-blur p-3">
      <div className={`text-xl font-mono tabular-nums ${accent || 'text-text'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted/70 mt-0.5">{label}</div>
    </div>
  )
}
