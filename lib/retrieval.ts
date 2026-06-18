// Production-grade retrieval pipeline:
// 1. Query Expansion       — generate variant queries with LLM
// 2. Multi-Query Retrieval — run all variants, merge candidate pools
// 3. Hybrid Search         — BM25 (MongoDB $text) + vector cosine similarity
// 4. Re-ranking            — LLM cross-encoder rerank over merged candidates
// 5. Context Compression   — extract only relevant sentences to fit token budget

import Memory, { type MemoryDoc } from '@/models/Memory'
import { embed, cosineSimilarity } from '@/lib/embeddings'
import { claude, CLAUDE_MODEL } from '@/lib/anthropic'
import type { Types } from 'mongoose'

// ── 1. Query Expansion ─────────────────────────────────────────────────────

export async function expandQuery(query: string, n = 3): Promise<string[]> {
  const prompt = `Generate ${n} diverse reformulations of the following search query to improve recall. Return as a JSON array of strings only. No preamble.

Query: "${query}"`
  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const variants: string[] = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    return [query, ...variants.slice(0, n)]
  } catch {
    return [query]
  }
}

// ── 2 + 3. Hybrid Multi-Query Retrieval ────────────────────────────────────

export interface RetrievedMemory {
  _id: string
  key: string
  value: string
  type: string
  importance: number
  tags: string[]
  bm25Score: number
  vectorScore: number
  hybridScore: number
  createdAt: Date
}

type MemoryFilter = {
  types?: string[]
  tags?: string[]
  minImportance?: number
  since?: Date
  pinned?: boolean
}

export async function hybridSearchMemories(
  userId: string,
  queries: string[],
  opts: {
    limit?: number
    filter?: MemoryFilter
    vectorWeight?: number  // 0–1; 1-vectorWeight goes to BM25
  } = {}
): Promise<RetrievedMemory[]> {
  const { limit = 12, filter = {}, vectorWeight = 0.6 } = opts
  const bm25Weight = 1 - vectorWeight

  const base: Record<string, unknown> = { userId, archived: false }
  if (filter.types?.length)     base.type = { $in: filter.types }
  if (filter.tags?.length)      base.tags = { $in: filter.tags }
  if (filter.minImportance)     base.importance = { $gte: filter.minImportance }
  if (filter.since)             base.createdAt = { $gte: filter.since }
  if (filter.pinned !== undefined) base.pinned = filter.pinned

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidateMap = new Map<string, { doc: any; bm25: number; vector: number }>()

  for (const q of queries) {
    // BM25 — MongoDB full-text search
    try {
      const bm25Docs = await Memory.find(
        { ...base, $text: { $search: q } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .lean()

      for (const doc of bm25Docs) {
        const id = String(doc._id)
        const prev = candidateMap.get(id) || { doc, bm25: 0, vector: 0 }
        // @ts-expect-error lean adds `score` via projection
        prev.bm25 = Math.max(prev.bm25, Number(doc.score) || 0)
        prev.doc = doc
        candidateMap.set(id, prev)
      }
    } catch {
      // text index may not exist yet — fall through to vector only
    }

    // Vector — embed query, then cosine similarity against stored embeddings
    try {
      const qVec = await embed(q)
      const allDocs = await Memory.find({ ...base, embedding: { $exists: true, $ne: [] } })
        .select('key value type importance tags embedding createdAt')
        .lean()

      for (const doc of allDocs) {
        if (!doc.embedding?.length) continue
        const score = cosineSimilarity(qVec, doc.embedding as number[])
        if (score < 0.3) continue  // ignore weak semantic matches
        const id = String(doc._id)
        const prev = candidateMap.get(id) || { doc, bm25: 0, vector: 0 }
        prev.vector = Math.max(prev.vector, score)
        prev.doc = doc
        candidateMap.set(id, prev)
      }
    } catch {
      // embedding unavailable — degrade gracefully
    }
  }

  // If no candidates at all (no text index, no embeddings) do a plain fetch
  if (candidateMap.size === 0) {
    const fallback = await Memory.find(base)
      .sort({ pinned: -1, importance: -1, updatedAt: -1 })
      .limit(limit)
      .lean()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fallback as any[]).map(mapDoc)
  }

  const MAX_BM25 = Math.max(...[...candidateMap.values()].map((v) => v.bm25), 1)

  const scored = [...candidateMap.values()]
    .map(({ doc, bm25, vector }) => ({
      ...mapDoc(doc),
      bm25Score: bm25 / MAX_BM25,
      vectorScore: vector,
      hybridScore: bm25Weight * (bm25 / MAX_BM25) + vectorWeight * vector
    }))
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit * 2)  // over-fetch for reranker

  return scored
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDoc(doc: any): RetrievedMemory {
  return {
    _id: String(doc._id),
    key: doc.key ?? '',
    value: doc.value ?? '',
    type: doc.type ?? 'long_term',
    importance: doc.importance ?? 3,
    tags: doc.tags ?? [],
    bm25Score: 0,
    vectorScore: 0,
    hybridScore: 0,
    createdAt: doc.createdAt ?? new Date()
  }
}

// ── 4. Re-ranking ─────────────────────────────────────────────────────────

export async function rerankMemories(
  query: string,
  candidates: RetrievedMemory[],
  topK = 8
): Promise<RetrievedMemory[]> {
  if (candidates.length <= topK) return candidates

  const numbered = candidates
    .slice(0, 20)
    .map((c, i) => `[${i}] ${c.key}: ${c.value.slice(0, 120)}`)
    .join('\n')

  const prompt = `You are a relevance judge. Rank the following memory snippets by how useful they are for answering the query. Return ONLY a JSON array of indices (most → least relevant), e.g. [3,0,7,...]. Include all relevant ones; omit clearly irrelevant ones.

Query: "${query}"

Memories:
${numbered}`

  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const indices: number[] = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
    const reranked = indices
      .filter((i) => i >= 0 && i < candidates.length)
      .map((i) => candidates[i])
    // Append anything not ranked
    const ranked = new Set(reranked.map((c) => c._id))
    for (const c of candidates) {
      if (!ranked.has(c._id)) reranked.push(c)
    }
    return reranked.slice(0, topK)
  } catch {
    return candidates.slice(0, topK)
  }
}

// ── 5. Context Compression ────────────────────────────────────────────────

export async function compressContext(
  query: string,
  memories: RetrievedMemory[],
  maxTokens = 800
): Promise<string> {
  const raw = memories
    .map((m) => `[${m.key}] ${m.value}`)
    .join('\n')

  if (raw.length < maxTokens * 4) return raw  // rough char-to-token heuristic

  const prompt = `Extract only the sentences from the context below that are directly relevant to the query. Preserve exact wording. Return as plain text, one fact per line.

Query: "${query}"

Context:
${raw.slice(0, 6000)}`

  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    return text.trim() || raw.slice(0, maxTokens * 4)
  } catch {
    return raw.slice(0, maxTokens * 4)
  }
}

// ── Full pipeline convenience wrapper ─────────────────────────────────────

export async function retrieveMemories(
  userId: string,
  query: string,
  opts: {
    limit?: number
    filter?: MemoryFilter
    expand?: boolean
    rerank?: boolean
    compress?: boolean
    vectorWeight?: number
  } = {}
): Promise<{ memories: RetrievedMemory[]; context: string }> {
  const { limit = 8, expand = true, rerank = true, compress = true } = opts

  const queries = expand ? await expandQuery(query, 2) : [query]
  const candidates = await hybridSearchMemories(userId, queries, {
    limit: rerank ? limit * 2 : limit,
    filter: opts.filter,
    vectorWeight: opts.vectorWeight
  })
  const reranked = rerank ? await rerankMemories(query, candidates, limit) : candidates.slice(0, limit)
  const context = compress ? await compressContext(query, reranked) : reranked.map((m) => `[${m.key}] ${m.value}`).join('\n')

  return { memories: reranked, context }
}
