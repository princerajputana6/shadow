// Gemini text-embedding-004 — 768-dim dense vectors, free tier.
// Used for semantic search across Memory and KnowledgeDoc collections.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const EMBED_MODEL = 'text-embedding-004'
const DIMS = 768

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const url = `${BASE}/${EMBED_MODEL}:embedContent?key=${apiKey}`
  const body = {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] }
  }

  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (e) {
      lastErr = e
      await sleep(1500 * (attempt + 1))
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'))
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * (attempt + 1))
      lastErr = new Error(`Embedding ${res.status}`)
      continue
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Embedding ${res.status}: ${detail.slice(0, 200)}`)
    }
    const data = await res.json()
    return data?.embedding?.values as number[]
  }
  throw lastErr instanceof Error ? lastErr : new Error('Embedding request failed')
}

// Batch embed — rate-limits to avoid hitting Gemini free-tier caps.
export async function embedBatch(texts: string[], delayMs = 100): Promise<number[][]> {
  const results: number[][] = []
  for (const t of texts) {
    results.push(await embed(t))
    if (delayMs > 0) await sleep(delayMs)
  }
  return results
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

// Score and rank a list of items against a query embedding.
export function rerankByEmbedding<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  items: T[]
): (T & { score: number })[] {
  return items
    .map((item) => ({
      ...item,
      score: item.embedding ? cosineSimilarity(queryEmbedding, item.embedding) : 0
    }))
    .sort((a, b) => b.score - a.score)
}

export { DIMS }
