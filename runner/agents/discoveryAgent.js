import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Business from '../models/Business.js'
import Prospect from '../models/Prospect.js'
import AgentRun from '../models/AgentRun.js'
import { tavilySearch } from '../tools/tavilyTool.js'
import { hunterDomainSearch, domainFromUrl, isPlaceholderEmail } from '../tools/hunterTool.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'
const PER_RUN_QUERY_BUDGET = Number(process.env.DISCOVERY_QUERY_BUDGET || 8)

// runDiscoveryAgent(userId, { businessId? })
// If businessId is provided: target that business's profile.
// If omitted: run for every active business owned by the user.
export async function runDiscoveryAgent(userId, { businessId } = {}) {
  await connectDB()

  const user = await User.findById(userId)
  if (!user) throw new Error(`user ${userId} not found`)

  const businesses = businessId
    ? await Business.find({ _id: businessId, userId, active: true })
    : await Business.find({ userId, active: true })

  if (!businesses.length) {
    throw new Error('No active business found. Add one at /businesses first.')
  }

  const aggregateStats = { businessesProcessed: 0, queriesRun: 0, resultsScanned: 0, candidatesExtracted: 0, deduped: 0, prospectsStaged: 0, rejectedAsCompetitor: 0, emailsEnriched: 0 }

  for (const business of businesses) {
    const run = await AgentRun.create({
      userId, businessId: business._id,
      agentName: 'sales_finder', status: 'running',
      stats: { mode: 'discovery', business: business.name }
    })
    const stats = { queriesRun: 0, resultsScanned: 0, candidatesExtracted: 0, deduped: 0, prospectsStaged: 0, rejectedAsCompetitor: 0, emailsEnriched: 0 }
    try {
      await runForBusiness({ user, business, stats })
      business.lastDiscoveryAt = new Date()
      await business.save()
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'completed', completedAt: new Date(),
        stats: { ...stats, mode: 'discovery', business: business.name }
      })
    } catch (err) {
      console.error(`[discovery] business ${business.name} failed:`, err)
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'failed', errorMessage: err.message, completedAt: new Date(),
        stats: { ...stats, mode: 'discovery', business: business.name }
      })
    }
    aggregateStats.businessesProcessed++
    for (const k of Object.keys(stats)) aggregateStats[k] += stats[k]
  }

  return aggregateStats
}

async function runForBusiness({ business, stats }) {
  const queries = buildQueries(business).slice(0, PER_RUN_QUERY_BUDGET)
  for (const { q, topic, depth } of queries) {
    try {
      const results = await tavilySearch(q, { maxResults: 5, searchDepth: depth || 'basic', topic })
      stats.queriesRun++
      stats.resultsScanned += results.length

      for (const r of results) {
        const extracted = await extractProspect(r, business)
        if (!extracted) continue
        if (extracted.isCompetitor) { stats.rejectedAsCompetitor++; continue }
        stats.candidatesExtracted++

        const key = extracted.email || extracted.discoveryUrl
        if (!key) continue
        const existing = await Prospect.findOne({
          userId: business.userId,
          $or: [
            extracted.email ? { email: extracted.email } : null,
            extracted.discoveryUrl ? { discoveryUrl: extracted.discoveryUrl } : null
          ].filter(Boolean)
        })
        if (existing) { stats.deduped++; continue }

        // ── Hunter.io enrichment: if no email but we have a discovery URL,
        //    try to surface a real decision-maker email from that domain.
        let email = extracted.email
        let enrichedName = extracted.name
        if (!email && extracted.discoveryUrl && process.env.HUNTER_API_KEY) {
          try {
            const domain = domainFromUrl(extracted.discoveryUrl)
            // Hunter is per-company-website. We try the URL's domain first,
            // which is often the news source. The company's own domain is what
            // we want — but we don't always have it from Tavily. Use as-is.
            const hit = domain ? await hunterDomainSearch(domain) : null
            if (hit?.email && !hit.email.endsWith('@placeholder.invalid')) {
              email = hit.email
              if (!enrichedName && (hit.firstName || hit.lastName)) {
                enrichedName = [hit.firstName, hit.lastName].filter(Boolean).join(' ')
              }
              stats.emailsEnriched++
            }
          } catch (e) {
            console.warn('[discovery] hunter enrichment failed:', e.message)
          }
        }

        try {
          await Prospect.create({
            userId: business.userId,
            businessId: business._id,
            name: enrichedName,
            email: email || `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.invalid`,
            company: extracted.company,
            source: 'discovered',
            status: 'not_contacted',
            consent: { granted: false },
            discoveryNotes: extracted.summary,
            discoverySignal: extracted.signal,
            discoveryUrl: extracted.discoveryUrl
          })
          stats.prospectsStaged++
        } catch (e) {
          console.warn('[discovery] create skipped:', e.message)
        }
      }
    } catch (e) {
      console.error(`[discovery] query failed q="${q}":`, e.message)
    }
  }
}

function buildQueries(business) {
  const regions = business.regions?.length ? business.regions : ['India']
  const keywords = (business.searchKeywords || []).slice(0, 4)
  const services = (business.services || []).slice(0, 4)
  const out = []

  // 1. Signal-of-spend NEWS queries — companies with imminent budget for tech.
  //    These are the highest-yield: funding announcements, new launches.
  for (const region of regions) {
    out.push({ q: `${region} startup raised seed funding 2026 D2C`, topic: 'news', depth: 'advanced' })
    out.push({ q: `${region} Series A funding 2026 software ecommerce`, topic: 'news', depth: 'advanced' })
    out.push({ q: `new D2C brand launch ${region} 2026`, topic: 'news', depth: 'basic' })
    out.push({ q: `${region} SMB digitalization 2026 announcement`, topic: 'news', depth: 'basic' })
  }
  // 2. Buyer-intent forum / Q&A queries — lower yield, occasionally hits.
  for (const kw of keywords) {
    for (const region of regions) {
      out.push({ q: `"${kw}" ${region} site:reddit.com OR site:quora.com`, depth: 'basic' })
    }
  }
  // 3. Industry signal queries — companies in ICP industries hiring or expanding.
  for (const region of regions) {
    for (const s of services) {
      out.push({ q: `${region} company hiring ${s} developer 2026`, depth: 'basic' })
    }
  }
  return out
}

async function extractProspect(result, business) {
  const services = (business.services || []).join(', ') || 'custom software'
  const exclude = (business.excludeKeywords || []).join(', ') || 'web development company, IT services firm'

  const prompt = `You are screening a web search result for a B2B sales pipeline. Be GENEROUS about relevance — a candidate company is anything that fits the ICP, even without explicit "we need X" intent. Funding announcements, new product launches, hiring news, and expansion stories all qualify as signals.

THE SELLING COMPANY:
- Name: ${business.name}
- What they sell: ${services}
- Ideal customer: ${business.idealCustomerProfile || 'small to mid-size businesses needing custom software'}

REJECT only if it looks like:
- A competitor offering ${services} (e.g. ${exclude})
- A directory listing of multiple companies with no single subject
- A generic listicle / tutorial / pricing guide with no specific company
- The seller's own website or a press release about the seller

ACCEPT if it looks like:
- A specific named company that fits the ICP — even if no explicit buyer intent
- A funding announcement (= imminent tech spend)
- A new D2C / SaaS / business launch (= needs site/app/system)
- A hiring announcement for a tech lead at a small company (often outsource MVP)
- An RFP or "looking for vendor" post

SEARCH RESULT:
Title: ${result.title}
URL: ${result.url}
Snippet: ${result.content}

Return ONLY valid JSON (no markdown):
{
  "relevant": true|false,
  "isCompetitor": true|false,
  "company": "specific company name or null — must be a SINGLE company, not a list",
  "name": "founder/CEO/contact name if visible or null",
  "email": "email if explicitly present or null",
  "signal": "short phrase, e.g. 'raised $2M seed Mar 2026' or 'D2C brand launched skincare line'",
  "summary": "1-2 sentence opportunity summary — why ${business.name} should reach out"
}`

  try {
    const res = await claude.messages.create({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(json)
    if (!parsed.relevant || !parsed.company) return null
    return {
      isCompetitor: !!parsed.isCompetitor,
      company: parsed.company,
      name: parsed.name,
      email: parsed.email?.toLowerCase(),
      signal: parsed.signal,
      summary: parsed.summary,
      discoveryUrl: result.url
    }
  } catch (e) {
    console.error('[discovery] extract failed:', e.message)
    return null
  }
}
