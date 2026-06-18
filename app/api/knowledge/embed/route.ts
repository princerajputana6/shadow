// Incremental embedding — embed only docs with missing/stale embeddings.
// Called by a cron job or manually via POST /api/knowledge/embed.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import KnowledgeDoc from '@/models/KnowledgeDoc'
import Memory from '@/models/Memory'
import { embed } from '@/lib/embeddings'

export const runtime = 'nodejs'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batchSize = 10, target = 'both' } = await req.json().catch(() => ({}))
  await connectDB()

  const userId = session.user.id
  let embedded = 0

  // Embed knowledge docs missing embeddings
  if (target === 'both' || target === 'knowledge') {
    const docs = await KnowledgeDoc.find({
      userId,
      $or: [{ embedding: { $exists: false } }, { embedding: [] }]
    })
      .limit(batchSize)
      .lean()

    for (const doc of docs) {
      try {
        const vec = await embed(`${doc.title}\n${String(doc.content).slice(0, 6000)}`)
        await KnowledgeDoc.updateOne(
          { _id: doc._id },
          { embedding: vec, embeddingUpdatedAt: new Date() }
        )
        embedded++
        await sleep(80)
      } catch (e) {
        console.warn('[embed] knowledge doc failed:', e)
      }
    }
  }

  // Embed memories missing embeddings
  if (target === 'both' || target === 'memories') {
    const mems = await Memory.find({
      userId,
      archived: false,
      $or: [{ embedding: { $exists: false } }, { embedding: [] }]
    })
      .limit(batchSize)
      .lean()

    for (const m of mems) {
      try {
        const vec = await embed(`${m.key}: ${m.value}`)
        await Memory.updateOne({ _id: m._id }, { embedding: vec })
        embedded++
        await sleep(80)
      } catch (e) {
        console.warn('[embed] memory failed:', e)
      }
    }
  }

  return NextResponse.json({ embedded })
}
