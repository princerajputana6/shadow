'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Memory, { MEMORY_TYPES, type MemoryType } from '@/models/Memory'
import { embed } from '@/lib/embeddings'
import { detectDuplicates, scoreImportance, consolidateMemories, autoSummarize, applyShortTermExpiry } from '@/lib/memoryOps'

async function authedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

function parseType(v: unknown): MemoryType {
  return MEMORY_TYPES.includes(v as MemoryType) ? (v as MemoryType) : 'long_term'
}
function parseTags(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 12)
}
function clampImportance(v: unknown): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3
}

export async function createMemory(form: FormData) {
  const userId = await authedUserId()
  const key = String(form.get('key') || '').trim()
  const value = String(form.get('value') || '').trim()
  if (!key || !value) throw new Error('Both a label and a value are required.')
  await connectDB()

  // Duplicate detection before insert
  const dups = await detectDuplicates(userId, `${key}: ${value}`, 0.93)
  if (dups.length > 0) {
    throw new Error(`Similar memory already exists: "${dups[0].key}". Edit it instead.`)
  }

  // Auto-score importance if not provided
  const rawImportance = form.get('importance')
  const importance = rawImportance
    ? clampImportance(rawImportance)
    : await scoreImportance(key, value).catch(() => 3)

  let embedding: number[] = []
  try { embedding = await embed(`${key}: ${value}`) } catch { /* skip if unavailable */ }

  await Memory.create({
    userId,
    key: key.slice(0, 160),
    value: value.slice(0, 4000),
    type: parseType(form.get('type')),
    importance,
    tags: parseTags(form.get('tags')),
    source: 'manual',
    embedding
  })
  revalidatePath('/memories')
}

export async function updateMemory(id: string, form: FormData) {
  const userId = await authedUserId()
  await connectDB()
  const m = await Memory.findOne({ _id: id, userId })
  if (!m) throw new Error('Not found')
  m.key = String(form.get('key') || m.key).trim().slice(0, 160)
  m.value = String(form.get('value') || m.value).trim().slice(0, 4000)
  m.type = parseType(form.get('type'))
  m.importance = clampImportance(form.get('importance'))
  m.tags = parseTags(form.get('tags'))

  // Re-embed on content change
  try { m.embedding = await embed(`${m.key}: ${m.value}`) } catch { /* skip */ }

  await m.save()
  revalidatePath('/memories')
}

export async function deleteMemory(id: string) {
  const userId = await authedUserId()
  await connectDB()
  await Memory.deleteOne({ _id: id, userId })
  revalidatePath('/memories')
}

export async function togglePin(id: string) {
  const userId = await authedUserId()
  await connectDB()
  const m = await Memory.findOne({ _id: id, userId })
  if (!m) throw new Error('Not found')
  m.pinned = !m.pinned
  await m.save()
  revalidatePath('/memories')
}

export async function toggleArchive(id: string) {
  const userId = await authedUserId()
  await connectDB()
  const m = await Memory.findOne({ _id: id, userId })
  if (!m) throw new Error('Not found')
  m.archived = !m.archived
  await m.save()
  revalidatePath('/memories')
}

// Trigger full memory maintenance (consolidation + summarization + expiry tagging)
export async function runMemoryMaintenance() {
  const userId = await authedUserId()
  await connectDB()
  const [consolidated, summarized, expiredTagged] = await Promise.all([
    consolidateMemories(userId),
    autoSummarize(userId),
    applyShortTermExpiry(userId)
  ])
  revalidatePath('/memories')
  return { consolidated, summarized, expiredTagged }
}
