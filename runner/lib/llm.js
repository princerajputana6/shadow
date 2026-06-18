// Gemini-backed LLM client exposing a Claude-`messages.create`-compatible
// interface, so existing agent code works unchanged after swapping the import:
//
//   import { llm as claude } from '../lib/llm.js'
//
// Free tier: create a key at https://aistudio.google.com/apikey (no card needed)
// and set GEMINI_API_KEY. Override the model with GEMINI_MODEL.
// Free-tier limits are ~15 requests/min and ~1500/day on the flash models — the
// retry/backoff below absorbs the occasional 429.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.0-flash'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function asText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('\n')
  return String(content ?? '')
}

// Map Claude-style { system, messages:[{role,content}] } → Gemini request body.
function toGeminiBody(messages = [], system) {
  const contents = []
  let sys = system ? asText(system) : ''
  for (const m of messages) {
    if (m.role === 'system') { sys = sys ? `${sys}\n${asText(m.content)}` : asText(m.content); continue }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: asText(m.content) }] })
  }
  const body = { contents }
  if (sys) body.systemInstruction = { parts: [{ text: sys }] }
  return body
}

async function create({ max_tokens, system, messages, temperature } = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const body = toGeminiBody(messages, system)
  body.generationConfig = {}
  if (max_tokens) body.generationConfig.maxOutputTokens = max_tokens
  if (typeof temperature === 'number') body.generationConfig.temperature = temperature

  const url = `${BASE}/${model}:generateContent?key=${apiKey}`
  let lastErr
  for (let attempt = 0; attempt < 4; attempt++) {
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    } catch (e) { lastErr = new Error((e?.message || 'network error').replace(/key=[A-Za-z0-9_\-]{20,}/g, 'key=[REDACTED]')); await sleep(1500 * (attempt + 1)); continue }

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
    const text = parts.map((p) => p.text || '').join('')
    const u = data?.usageMetadata || {}
    return {
      content: [{ type: 'text', text }],
      usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 },
      model
    }
  }
  throw lastErr || new Error('Gemini request failed')
}

export const llm = { messages: { create } }
export const LLM_MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL
