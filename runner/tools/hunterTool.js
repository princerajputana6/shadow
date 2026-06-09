// Thin Hunter.io wrapper. Free tier: 25 searches/month.
// https://hunter.io/api/v2/docs
//
// Two useful endpoints:
//   GET /domain-search?domain=X  → emails on that domain, sorted by confidence
//   GET /email-finder?domain=X&first_name=Y&last_name=Z  → guess a specific email
//
// Returns { email, name, position, confidence } or null.

const BASE = 'https://api.hunter.io/v2'

export function isPlaceholderEmail(email) {
  return !email || email.endsWith('@placeholder.invalid') || !email.includes('@')
}

export function domainFromUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

export async function hunterDomainSearch(domain, { limit = 5 } = {}) {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) throw new Error('HUNTER_API_KEY not set')
  if (!domain) return null

  const url = `${BASE}/domain-search?domain=${encodeURIComponent(domain)}&limit=${limit}&api_key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Hunter ${res.status}: ${t.slice(0, 200)}`)
  }
  const json = await res.json()
  const emails = json?.data?.emails || []
  if (!emails.length) return null
  // Prefer decision-maker seniority + highest confidence.
  const SENIOR_RX = /(ceo|founder|owner|director|head|vp|chief)/i
  const ranked = [...emails].sort((a, b) => {
    const aSenior = SENIOR_RX.test(a.position || '') ? 1 : 0
    const bSenior = SENIOR_RX.test(b.position || '') ? 1 : 0
    if (aSenior !== bSenior) return bSenior - aSenior
    return (b.confidence || 0) - (a.confidence || 0)
  })
  const pick = ranked[0]
  return {
    email: pick.value,
    firstName: pick.first_name,
    lastName: pick.last_name,
    position: pick.position,
    confidence: pick.confidence,
    domain
  }
}
