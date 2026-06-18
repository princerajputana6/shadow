// Gemini-backed LLM client with a Claude-`messages.create`-compatible surface.
// Kept under this filename + export names (`claude`, `CLAUDE_MODEL`) so existing
// importers (the Shadow assistant, businessFromUrl) stay unchanged.
//
// Free tier: key from https://aistudio.google.com/apikey (no card). Set GEMINI_API_KEY.
// Override the model with GEMINI_MODEL.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'

type Role = 'user' | 'assistant' | 'system'
type Msg = { role: Role; content: string }
type CreateArgs = { model?: string; max_tokens?: number; system?: string; messages: Msg[]; temperature?: number }
type CreateResult = {
  content: { type: 'text'; text: string }[]
  usage: { input_tokens: number; output_tokens: number }
  model: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function toGeminiBody(messages: Msg[], system?: string) {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  let sys = system || ''
  for (const m of messages) {
    if (m.role === 'system') { sys = sys ? `${sys}\n${m.content}` : m.content; continue }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
  }
  const body: Record<string, unknown> = { contents }
  if (sys) body.systemInstruction = { parts: [{ text: sys }] }
  return body
}

async function create({ max_tokens, system, messages, temperature }: CreateArgs): Promise<CreateResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const body = toGeminiBody(messages, system) as Record<string, unknown>
  const generationConfig: Record<string, unknown> = {}
  if (max_tokens) generationConfig.maxOutputTokens = max_tokens
  if (typeof temperature === 'number') generationConfig.temperature = temperature
  body.generationConfig = generationConfig

  const url = `${BASE}/${model}:generateContent?key=${apiKey}`
  let lastErr: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch (e) { lastErr = e; await sleep(1500 * (attempt + 1)); continue }

    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after'))
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * (attempt + 1) + Math.random() * 500)
      lastErr = new Error(`Gemini ${res.status} (rate limited / server error)`)
      continue
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`)
    }
    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts || []
    const text = parts.map((p: { text?: string }) => p.text || '').join('')
    const u = data?.usageMetadata || {}
    return {
      content: [{ type: 'text', text }],
      usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
      model
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini request failed')
}

export const claude = { messages: { create } }
export const CLAUDE_MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL
