import { claude, CLAUDE_MODEL } from '@/lib/anthropic'

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeUrl(input: string): string {
  let u = input.trim()
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export type ExtractedProfile = {
  name: string
  description: string
  services: string[]
  idealCustomerProfile: string
  searchKeywords: string[]
  excludeKeywords: string[]
  regions: string[]
}

export async function extractBusinessProfile(rawUrl: string): Promise<ExtractedProfile> {
  const url = normalizeUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  let html = ''
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal,
      redirect: 'follow'
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = await res.text()
  } finally {
    clearTimeout(timer)
  }

  const text = htmlToText(html).slice(0, 12_000) // generous but bounded

  const prompt = `You are profiling a B2B services company so an AI sales agent can find their ideal customers. Read this homepage text and extract a structured profile.

CRITICAL: The "searchKeywords" must be phrases a BUYER would write, not the seller. Example: if the company builds websites, a BUYER says "need a new website" — NOT "website development services" (which would just find competitors).

Homepage URL: ${url}

Homepage text:
"""
${text}
"""

Return ONLY valid JSON. No markdown, no explanation:
{
  "name": "company name as displayed",
  "description": "1-2 sentence description of what they do",
  "services": ["short list of what they sell, e.g. 'ecommerce website', 'mobile app', 'ERP', 'website redesign'"],
  "idealCustomerProfile": "1-2 sentences describing who buys from them — industry, size, pain point",
  "searchKeywords": [
    "8-12 buyer-intent phrases that would surface their ideal customers in a web search",
    "e.g. 'need an ecommerce website built'",
    "e.g. 'looking for ERP for small manufacturing business'",
    "e.g. 'shopify migration developer needed'",
    "INCLUDE specific industry+need combos based on the services listed"
  ],
  "excludeKeywords": [
    "phrases that signal a competitor or service provider rather than a buyer",
    "e.g. 'web development company', 'IT services firm', 'we offer development', 'outsourcing partner', 'app development agency'"
  ],
  "regions": ["primary geographic markets, e.g. 'India', 'UAE', 'US'"]
}`

  const res = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }]
  })
  const block = res.content[0]
  const raw = block?.type === 'text' ? block.text : ''
  const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const parsed = JSON.parse(json) as ExtractedProfile

  // Sanity defaults
  if (!parsed.regions?.length) parsed.regions = ['India']
  if (!parsed.searchKeywords) parsed.searchKeywords = []
  if (!parsed.excludeKeywords) parsed.excludeKeywords = []
  if (!parsed.services) parsed.services = []

  return parsed
}
