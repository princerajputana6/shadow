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
  stub?: boolean  // true when AI was unavailable — profile needs manual completion
}

// Extract what we can from raw HTML without AI: title, meta description,
// OG tags, h1/h2 headings, and visible body text.
function extractFromHtml(html: string, url: string): Partial<ExtractedProfile> {
  const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/\s*[|\-–—].*$/, '').trim() : ''

  // Meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i)
  const metaDesc = metaMatch ? metaMatch[1].trim() : ''

  // OG title / description
  const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i) || [])[1] || ''
  const ogDesc = (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i) || [])[1] || ''

  // H1 headings
  const h1s: string[] = []
  const h1rx = /<h1[^>]*>([\s\S]*?)<\/h1>/gi
  let m: RegExpExecArray | null
  while ((m = h1rx.exec(html)) !== null && h1s.length < 3) {
    const t = htmlToText(m[1]).trim().slice(0, 120)
    if (t) h1s.push(t)
  }

  // H2 headings (often list services)
  const h2s: string[] = []
  const h2rx = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  while ((m = h2rx.exec(html)) !== null && h2s.length < 8) {
    const t = htmlToText(m[1]).trim().slice(0, 80)
    if (t && t.split(' ').length <= 8) h2s.push(t)  // short h2s are often service names
  }

  const name = ogTitle || title || hostname.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const description = ogDesc || metaDesc || (h1s[0] ? `${h1s[0]}` : `Business at ${hostname}`)

  return {
    name: name.slice(0, 100),
    description: description.slice(0, 500),
    services: h2s.slice(0, 8),
    idealCustomerProfile: '',
    searchKeywords: [],
    excludeKeywords: [],
    regions: ['India']
  }
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

  // Always extract HTML-level info first — this is our guaranteed fallback.
  const htmlProfile = extractFromHtml(html, url)
  const text = htmlToText(html).slice(0, 12_000)

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

  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = res.content[0]
    const raw = block?.type === 'text' ? block.text : ''
    const json = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(json) as ExtractedProfile

    // Sanity defaults — fill from HTML extraction if AI left fields blank
    if (!parsed.name) parsed.name = htmlProfile.name!
    if (!parsed.description) parsed.description = htmlProfile.description!
    if (!parsed.regions?.length) parsed.regions = ['India']
    if (!parsed.searchKeywords) parsed.searchKeywords = []
    if (!parsed.excludeKeywords) parsed.excludeKeywords = []
    if (!parsed.services?.length) parsed.services = htmlProfile.services || []

    return parsed
  } catch {
    // AI unavailable — return the HTML-extracted profile so the user at least
    // gets the name, description, and headings (services) pre-filled.
    return { ...htmlProfile as ExtractedProfile, stub: true }
  }
}
