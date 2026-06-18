// Runner-side memory ops — mirrors lib/memoryOps.ts but uses CommonJS-compatible imports.
// Used by the cron jobs in index.js for nightly memory maintenance.

import { connectDB } from './mongoose.js'
import { llm as claude } from './llm.js'
import Memory from '../models/Memory.js'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const EMBED_MODEL = 'text-embedding-004'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function embed(text) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const url = `${BASE}/${EMBED_MODEL}:embedContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text: text.slice(0, 8000) }] } })
  })
  if (!res.ok) throw new Error(`Embed ${res.status}`)
  const data = await res.json()
  return data?.embedding?.values
}

function cosine(a, b) {
  if (!a?.length || a.length !== b?.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

export async function consolidateMemories(userId, threshold = 0.88) {
  await connectDB()
  const all = await Memory.find({ userId, archived: false, embedding: { $exists: true, $ne: [] } })
    .select('_id key value type importance embedding').lean()
  if (all.length < 2) return 0

  const parent = new Map()
  for (const m of all) parent.set(String(m._id), String(m._id))
  const findRoot = (id) => { if (parent.get(id) === id) return id; const r = findRoot(parent.get(id)); parent.set(id, r); return r }

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const sim = cosine(all[i].embedding, all[j].embedding)
      if (sim >= threshold) { const ri = findRoot(String(all[i]._id)), rj = findRoot(String(all[j]._id)); if (ri !== rj) parent.set(rj, ri) }
    }
  }

  const clusters = new Map()
  for (const m of all) { const root = findRoot(String(m._id)); if (!clusters.has(root)) clusters.set(root, []); clusters.get(root).push(m) }

  let consolidated = 0
  for (const [, members] of clusters) {
    if (members.length < 2) continue
    const items = members.map(m => `[${m.key}] ${m.value}`).join('\n')
    try {
      const res = await claude.messages.create({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: `Merge these related memories into one. Return JSON {key, value} only.\n\n${items}` }] })
      const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
      const merged = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
      if (!merged.key || !merged.value) continue
      const maxImp = Math.max(...members.map(m => m.importance ?? 3))
      let embedding = []
      try { embedding = await embed(`${merged.key}: ${merged.value}`); await sleep(80) } catch {}
      const sourceIds = members.map(m => m._id)
      await Memory.create({ userId, key: merged.key.slice(0, 160), value: merged.value.slice(0, 4000), type: members[0].type ?? 'long_term', importance: maxImp, source: 'consolidated', consolidatedFrom: sourceIds, consolidationNote: `Consolidated ${members.length} memories`, embedding })
      await Memory.updateMany({ _id: { $in: sourceIds } }, { archived: true })
      consolidated += members.length
    } catch { /* skip */ }
  }
  return consolidated
}

export async function autoSummarize(userId, olderThanDays = 3) {
  await connectDB()
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000)
  const stale = await Memory.find({ userId, type: 'short_term', archived: false, createdAt: { $lt: cutoff } }).sort({ createdAt: 1 }).limit(30).lean()
  if (stale.length < 3) return 0

  const items = stale.map((m, i) => `${i + 1}. [${m.key}] ${m.value}`).join('\n')
  const prompt = `Summarize these short-term memory entries into 2-4 long-term facts. Return as JSON array of {key, value}.\n\n${items}`
  let summaries = []
  try {
    const res = await claude.messages.create({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    summaries = JSON.parse(text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  } catch { return 0 }

  const sourceIds = stale.map(m => m._id)
  for (const s of summaries) {
    if (!s.key || !s.value) continue
    let embedding = []
    try { embedding = await embed(`${s.key}: ${s.value}`); await sleep(80) } catch {}
    await Memory.create({ userId, key: s.key.slice(0, 160), value: s.value.slice(0, 4000), type: 'long_term', importance: 3, source: 'auto_summarized', consolidatedFrom: sourceIds, embedding })
  }
  await Memory.updateMany({ _id: { $in: sourceIds } }, { archived: true })
  return stale.length
}

export async function applyShortTermExpiry(userId, ttlDays = 7) {
  await connectDB()
  const expiry = new Date(Date.now() + ttlDays * 86400_000)
  const result = await Memory.updateMany({ userId, type: 'short_term', expiresAt: null, archived: false }, { expiresAt: expiry })
  return result.modifiedCount
}
