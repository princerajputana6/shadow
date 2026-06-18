// Memory lifecycle operations:
// - importanceScore    : LLM-scored importance for chat-extracted memories
// - autoSummarize      : collapse old short_term memories into a long_term summary
// - consolidate        : merge semantically near-duplicate memories
// - detectDuplicates   : find existing memories similar to a candidate
// - expireShortTerm    : set TTL on short_term memories older than N days

import Memory from '@/models/Memory'
import { embed, cosineSimilarity } from '@/lib/embeddings'
import { claude, CLAUDE_MODEL } from '@/lib/anthropic'

// ── Importance Scoring ─────────────────────────────────────────────────────

export async function scoreImportance(key: string, value: string): Promise<number> {
  const prompt = `Rate the importance of this memory for a business assistant on a scale 1–5.
1 = trivial / ephemeral  2 = low  3 = moderate  4 = high  5 = critical / evergreen

Key: ${key}
Value: ${value}

Reply with a single digit only.`
  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : '3'
    const n = parseInt(text[0], 10)
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 3
  } catch {
    return 3
  }
}

// ── Auto Summarization ─────────────────────────────────────────────────────
// Collapses short_term memories older than `olderThanDays` into one long_term
// summary entry, then archives the originals.

export async function autoSummarize(userId: string, olderThanDays = 3): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000)
  const stale = await Memory.find({
    userId,
    type: 'short_term',
    archived: false,
    createdAt: { $lt: cutoff }
  })
    .sort({ createdAt: 1 })
    .limit(30)
    .lean()

  if (stale.length < 3) return 0

  const items = stale.map((m, i) => `${i + 1}. [${m.key}] ${m.value}`).join('\n')
  const prompt = `Summarize the following short-term memory entries into 2-4 concise long-term facts. Focus on durable, reusable information. Return as a JSON array of {key, value} objects only.

${items}`

  let summaries: { key: string; value: string }[] = []
  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    summaries = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  } catch {
    return 0
  }

  const sourceIds = stale.map((m) => m._id)
  for (const s of summaries) {
    if (!s.key || !s.value) continue
    const importance = await scoreImportance(s.key, s.value)
    let embedding: number[] = []
    try { embedding = await embed(`${s.key}: ${s.value}`) } catch { /* skip */ }

    await Memory.create({
      userId,
      key: s.key.slice(0, 160),
      value: s.value.slice(0, 4000),
      type: 'long_term',
      importance,
      source: 'auto_summarized',
      consolidatedFrom: sourceIds,
      consolidationNote: `Auto-summarized ${stale.length} short-term memories from before ${cutoff.toISOString().slice(0, 10)}`,
      embedding
    })
  }

  await Memory.updateMany({ _id: { $in: sourceIds } }, { archived: true })
  return stale.length
}

// ── Memory Consolidation ──────────────────────────────────────────────────
// Finds clusters of semantically similar memories and merges each cluster
// into a single richer entry. Returns number of memories consolidated.

export async function consolidateMemories(userId: string, threshold = 0.88): Promise<number> {
  const all = await Memory.find({ userId, archived: false, embedding: { $exists: true, $ne: [] } })
    .select('_id key value type importance embedding')
    .lean()

  if (all.length < 2) return 0

  // Build similarity clusters (union-find style)
  const parent = new Map<string, string>()
  const findRoot = (id: string): string => {
    if (parent.get(id) === id) return id
    const root = findRoot(parent.get(id)!)
    parent.set(id, root)
    return root
  }
  for (const m of all) parent.set(String(m._id), String(m._id))

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (!all[i].embedding?.length || !all[j].embedding?.length) continue
      const sim = cosineSimilarity(all[i].embedding as number[], all[j].embedding as number[])
      if (sim >= threshold) {
        const ri = findRoot(String(all[i]._id))
        const rj = findRoot(String(all[j]._id))
        if (ri !== rj) parent.set(rj, ri)
      }
    }
  }

  // Group by root
  const clusters = new Map<string, typeof all>()
  for (const m of all) {
    const root = findRoot(String(m._id))
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(m)
  }

  let consolidated = 0
  for (const [, members] of clusters) {
    if (members.length < 2) continue

    const items = members.map((m) => `[${m.key}] ${m.value}`).join('\n')
    const prompt = `Merge these related memories into one clear, comprehensive entry. Return JSON {key, value} only.

${items}`

    try {
      const res = await claude.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
      const merged = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
      if (!merged.key || !merged.value) continue

      const maxImportance = Math.max(...members.map((m) => m.importance ?? 3))
      let embedding: number[] = []
      try { embedding = await embed(`${merged.key}: ${merged.value}`) } catch { /* skip */ }

      const sourceIds = members.map((m) => m._id)
      await Memory.create({
        userId,
        key: merged.key.slice(0, 160),
        value: merged.value.slice(0, 4000),
        type: members[0].type ?? 'long_term',
        importance: maxImportance,
        source: 'consolidated',
        consolidatedFrom: sourceIds,
        consolidationNote: `Consolidated ${members.length} near-duplicate memories`,
        embedding
      })
      await Memory.updateMany({ _id: { $in: sourceIds } }, { archived: true })
      consolidated += members.length
    } catch {
      // skip this cluster
    }
  }

  return consolidated
}

// ── Duplicate Detection ───────────────────────────────────────────────────
// Returns existing memories similar to a candidate (before inserting).

export async function detectDuplicates(
  userId: string,
  text: string,
  threshold = 0.92
): Promise<{ _id: string; key: string; value: string; score: number }[]> {
  let qVec: number[]
  try {
    qVec = await embed(text)
  } catch {
    return []
  }

  const existing = await Memory.find({ userId, archived: false, embedding: { $exists: true, $ne: [] } })
    .select('_id key value embedding')
    .lean()

  return existing
    .map((m) => ({
      _id: String(m._id),
      key: m.key,
      value: m.value,
      score: cosineSimilarity(qVec, m.embedding as number[])
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// ── Short-Term Expiry ─────────────────────────────────────────────────────
// Sets expiresAt on short_term memories that don't have one yet.

export async function applyShortTermExpiry(userId: string, ttlDays = 7): Promise<number> {
  const expiry = new Date(Date.now() + ttlDays * 86400_000)
  const result = await Memory.updateMany(
    { userId, type: 'short_term', expiresAt: null, archived: false },
    { expiresAt: expiry }
  )
  return result.modifiedCount
}

// ── Extract memories from chat turn ──────────────────────────────────────

export async function extractMemoriesFromChat(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<number> {
  const prompt = `Extract durable facts about the user or their business from this conversation turn. Return as JSON array of {key, value, type, tags} objects. Use types: short_term | long_term | episodic | semantic. Return [] if nothing durable.

User: ${userMessage.slice(0, 800)}
Assistant: ${assistantResponse.slice(0, 800)}`

  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const facts: { key: string; value: string; type: string; tags?: string[] }[] = JSON.parse(
      text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    )
    if (!Array.isArray(facts) || !facts.length) return 0

    let count = 0
    for (const f of facts.slice(0, 5)) {
      if (!f.key || !f.value) continue
      const dups = await detectDuplicates(userId, `${f.key}: ${f.value}`, 0.94)
      if (dups.length > 0) continue  // skip near-duplicates

      const importance = await scoreImportance(f.key, f.value)
      let embedding: number[] = []
      try { embedding = await embed(`${f.key}: ${f.value}`) } catch { /* skip */ }

      await Memory.create({
        userId,
        key: f.key.slice(0, 160),
        value: f.value.slice(0, 4000),
        type: ['short_term', 'long_term', 'episodic', 'semantic'].includes(f.type) ? f.type : 'short_term',
        importance,
        tags: (f.tags || []).slice(0, 8),
        source: 'chat_extracted',
        embedding,
        expiresAt: f.type === 'short_term' ? new Date(Date.now() + 7 * 86400_000) : null
      })
      count++
    }
    return count
  } catch {
    return 0
  }
}
