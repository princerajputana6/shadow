// Hybrid semantic + keyword search over the knowledge base.
// Uses same retrieval pipeline as memory search.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import KnowledgeDoc from '@/models/KnowledgeDoc'
import { embed, cosineSimilarity } from '@/lib/embeddings'
import { expandQuery, compressContext } from '@/lib/retrieval'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, folderId, limit = 8, expand = true, compress = false } = await req.json().catch(() => ({}))
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  await connectDB()

  const base: Record<string, unknown> = { userId: session.user.id, archived: false }
  if (folderId) base.folderId = folderId

  const queries = expand ? await expandQuery(query, 2) : [query]
  const candidateMap = new Map<string, { doc: Record<string, unknown>; bm25: number; vector: number }>()

  for (const q of queries) {
    // BM25
    try {
      const bm25Docs = await KnowledgeDoc.find(
        { ...base, $text: { $search: q } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(15)
        .select('-history')
        .lean()

      for (const doc of bm25Docs) {
        const id = String(doc._id)
        const prev = candidateMap.get(id) || { doc, bm25: 0, vector: 0 }
        // @ts-expect-error textScore
        prev.bm25 = Math.max(prev.bm25, Number(doc.score) || 0)
        prev.doc = doc as Record<string, unknown>
        candidateMap.set(id, prev)
      }
    } catch { /* text index may not exist */ }

    // Vector
    try {
      const qVec = await embed(q)
      const allDocs = await KnowledgeDoc.find({ ...base, embedding: { $exists: true, $ne: [] } })
        .select('_id title content tags embedding')
        .lean()

      for (const doc of allDocs) {
        if (!doc.embedding?.length) continue
        const score = cosineSimilarity(qVec, doc.embedding as number[])
        if (score < 0.3) continue
        const id = String(doc._id)
        const prev = candidateMap.get(id) || { doc: doc as Record<string, unknown>, bm25: 0, vector: 0 }
        prev.vector = Math.max(prev.vector, score)
        prev.doc = doc as Record<string, unknown>
        candidateMap.set(id, prev)
      }
    } catch { /* embedding unavailable */ }
  }

  if (candidateMap.size === 0) {
    const fallback = await KnowledgeDoc.find(base)
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(limit)
      .select('-embedding -history')
      .lean()
    return NextResponse.json({ results: fallback, context: '' })
  }

  const MAX_BM25 = Math.max(...[...candidateMap.values()].map((v) => v.bm25), 1)
  const scored = [...candidateMap.values()]
    .map(({ doc, bm25, vector }) => ({
      ...doc,
      _bm25: bm25 / MAX_BM25,
      _vector: vector,
      _score: 0.4 * (bm25 / MAX_BM25) + 0.6 * vector
    }))
    .sort((a, b) => (b._score as number) - (a._score as number))
    .slice(0, limit)

  type ScoredDoc = { title?: string; content?: string; _id?: unknown }
  let context = ''
  if (compress) {
    const mockMemories = scored.map((d) => ({
      _id: String((d as ScoredDoc)._id),
      key: String((d as ScoredDoc).title || ''),
      value: String((d as ScoredDoc).content || '').slice(0, 500),
      type: 'semantic',
      importance: 3,
      tags: [],
      bm25Score: 0,
      vectorScore: 0,
      hybridScore: 0,
      createdAt: new Date()
    }))
    context = await compressContext(query, mockMemories)
  }

  return NextResponse.json({ results: scored, context })
}
