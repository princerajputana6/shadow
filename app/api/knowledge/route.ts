import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import KnowledgeDoc from '@/models/KnowledgeDoc'
import KnowledgeFolder from '@/models/KnowledgeFolder'
import { embed } from '@/lib/embeddings'
import crypto from 'crypto'

export const runtime = 'nodejs'

function contentHash(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
}

// GET /api/knowledge?folderId=&q=&page=
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folderId')
  const q = searchParams.get('q')
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const limit = 20

  await connectDB()
  const base: Record<string, unknown> = { userId: session.user.id, archived: false }
  if (folderId) base.folderId = folderId

  let docs, total
  if (q) {
    ;[docs, total] = await Promise.all([
      KnowledgeDoc.find({ ...base, $text: { $search: q } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-embedding -history')
        .lean(),
      KnowledgeDoc.countDocuments({ ...base, $text: { $search: q } })
    ])
  } else {
    ;[docs, total] = await Promise.all([
      KnowledgeDoc.find(base)
        .sort({ pinned: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-embedding -history')
        .lean(),
      KnowledgeDoc.countDocuments(base)
    ])
  }

  const folders = await KnowledgeFolder.find({ userId: session.user.id, archived: false }).lean()
  return NextResponse.json({ docs, folders, total, page, pages: Math.ceil(total / limit) })
}

// POST /api/knowledge — create a document
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { title, content, folderId, tags, source } = body
  if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })

  await connectDB()

  const hash = contentHash(content)
  const existing = await KnowledgeDoc.findOne({ userId: session.user.id, contentHash: hash })
  if (existing) {
    return NextResponse.json({ error: 'Duplicate content detected', existingId: String(existing._id) }, { status: 409 })
  }

  let embedding: number[] = []
  try { embedding = await embed(`${title}\n${content}`.slice(0, 8000)) } catch { /* skip */ }

  const doc = await KnowledgeDoc.create({
    userId: session.user.id,
    folderId: folderId || null,
    title: String(title).slice(0, 300),
    content: String(content).slice(0, 100_000),
    tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
    source: source || 'manual',
    embedding,
    embeddingUpdatedAt: embedding.length ? new Date() : null,
    contentHash: hash,
    version: 1,
    history: []
  })

  return NextResponse.json({ doc }, { status: 201 })
}

// PATCH /api/knowledge?id= — update (saves version to history)
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  await connectDB()
  const doc = await KnowledgeDoc.findOne({ _id: id, userId: session.user.id })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Save current state to history before overwriting
  doc.history.push({
    content: doc.content,
    title: doc.title,
    editedAt: new Date(),
    editedBy: session.user.id as unknown as import('mongoose').Types.ObjectId,
    changeNote: body.changeNote || ''
  })
  if (doc.history.length > 50) doc.history.shift()  // keep last 50 versions

  if (body.title) doc.title = String(body.title).slice(0, 300)
  if (body.content) {
    doc.content = String(body.content).slice(0, 100_000)
    doc.contentHash = contentHash(doc.content)
    try {
      doc.embedding = await embed(`${doc.title}\n${doc.content}`.slice(0, 8000))
      doc.embeddingUpdatedAt = new Date()
    } catch { /* skip */ }
  }
  if (Array.isArray(body.tags)) doc.tags = body.tags.slice(0, 20)
  if (body.folderId !== undefined) doc.folderId = body.folderId || null
  if (body.pinned !== undefined) doc.pinned = !!body.pinned
  doc.version = (doc.version || 1) + 1

  await doc.save()
  return NextResponse.json({ doc })
}

// DELETE /api/knowledge?id=
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await connectDB()
  await KnowledgeDoc.deleteOne({ _id: id, userId: session.user.id })
  return NextResponse.json({ ok: true })
}
