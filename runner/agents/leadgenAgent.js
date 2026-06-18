import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Business from '../models/Business.js'
import Prospect from '../models/Prospect.js'
import AgentRun from '../models/AgentRun.js'
import { tavilySearch } from '../tools/tavilyTool.js'
import { hunterDomainSearch, domainFromUrl } from '../tools/hunterTool.js'
import { ensureCrmSheet, appendLeads } from '../tools/sheetsTool.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'
const PER_RUN_QUERY_BUDGET = Number(process.env.LEADGEN_QUERY_BUDGET || 10)

// LinkedIn-sourced lead generation, ToS-safe: we DISCOVER public profiles via
// Google X-ray search (through Tavily), never scrape or auto-message LinkedIn.
// Outreach happens by email via the Sales agent. Each lead is staged in Mongo
// (consent NOT granted) and mirrored to the user's Google Sheet CRM for review.
export async function runLeadgenAgent(userId, { businessId } = {}) {
  await connectDB()
  const user = await User.findById(userId)
  if (!user) throw new Error(`user ${userId} not found`)
  if (!user.googleTokens?.refreshToken) {
    throw new Error('Connect Google (with Sheets scope) in /integrations first')
  }

  const businesses = businessId
    ? await Business.find({ _id: businessId, userId, active: true })
    : await Business.find({ userId, active: true })
  if (!businesses.length) throw new Error('No active business — add one at /businesses')

  // One CRM sheet per user, created on first run.
  const { spreadsheetId, url } = await ensureCrmSheet(user)

  const aggregate = { businessesProcessed: 0, queriesRun: 0, resultsScanned: 0, candidates: 0, deduped: 0, staged: 0, emailsEnriched: 0, rejected: 0, crmUrl: url }

  for (const business of businesses) {
    const run = await AgentRun.create({
      userId, businessId: business._id,
      agentName: 'sales_finder', status: 'running',
      stats: { mode: 'leadgen', business: business.name }
    })
    const stats = { queriesRun: 0, resultsScanned: 0, candidates: 0, deduped: 0, staged: 0, emailsEnriched: 0, rejected: 0 }
    try {
      await runForBusiness({ user, business, spreadsheetId, stats })
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'completed', completedAt: new Date(),
        stats: { ...stats, mode: 'leadgen', business: business.name, crmUrl: url }
      })
    } catch (err) {
      console.error(`[leadgen] ${business.name} failed:`, err)
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'failed', errorMessage: err.message, completedAt: new Date(),
        stats: { ...stats, mode: 'leadgen', business: business.name }
      })
    }
    aggregate.businessesProcessed++
    for (const k of Object.keys(stats)) aggregate[k] += stats[k]
  }
  return aggregate
}

async function runForBusiness({ user, business, spreadsheetId, stats }) {
  const queries = buildLeadQueries(business).slice(0, PER_RUN_QUERY_BUDGET)
  const newRows = []

  for (const { q, depth } of queries) {
    try {
      const results = await tavilySearch(q, { maxResults: 5, searchDepth: depth || 'basic' })
      stats.queriesRun++
      stats.resultsScanned += results.length

      for (const r of results) {
        const lead = await extractLead(r, business)
        if (!lead || !lead.relevant) { stats.rejected++; continue }
        if (lead.isCompetitor) { stats.rejected++; continue }
        stats.candidates++

        const linkedinUrl = isLinkedInProfile(r.url) ? r.url : (lead.linkedinUrl || undefined)

        // Dedupe against existing prospects (by linkedin or email).
        const dupeOr = [
          linkedinUrl ? { linkedinUrl } : null,
          lead.email ? { email: lead.email.toLowerCase() } : null
        ].filter(Boolean)
        if (dupeOr.length) {
          const existing = await Prospect.findOne({ userId: user._id, $or: dupeOr })
          if (existing) { stats.deduped++; continue }
        }

        // Email enrichment via Hunter when we have a company domain but no email.
        let email = lead.email
        if (!email && lead.companyDomain && process.env.HUNTER_API_KEY) {
          try {
            const hit = await hunterDomainSearch(domainFromUrl(lead.companyDomain))
            if (hit?.email && !hit.email.endsWith('@placeholder.invalid')) {
              email = hit.email
              stats.emailsEnriched++
            }
          } catch (e) { console.warn('[leadgen] hunter failed:', e.message) }
        }

        try {
          await Prospect.create({
            userId: user._id,
            businessId: business._id,
            name: lead.name,
            email: email || `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@placeholder.invalid`,
            company: lead.company,
            title: lead.title,
            linkedinUrl,
            source: 'discovered',
            status: 'not_contacted',
            consent: { granted: false },
            discoveryNotes: lead.summary,
            discoverySignal: lead.signal,
            discoveryUrl: linkedinUrl || r.url
          })
          stats.staged++
          newRows.push({
            name: lead.name, title: lead.title, company: lead.company,
            linkedinUrl, email: email && !email.endsWith('@placeholder.invalid') ? email : '',
            signal: lead.signal, fitScore: lead.fitScore, status: 'New',
            notes: lead.summary
          })
        } catch (e) {
          console.warn('[leadgen] create skipped:', e.message)
        }
      }
    } catch (e) {
      console.error(`[leadgen] query failed q="${q}":`, e.message)
    }
  }

  // Mirror new prospects into the CRM sheet (best-effort).
  if (newRows.length) {
    try { await appendLeads(user.googleTokens, spreadsheetId, newRows) }
    catch (e) { console.error('[leadgen] sheet append failed:', e.message) }
  }
}

function isLinkedInProfile(url) {
  return typeof url === 'string' && /linkedin\.com\/(in|company)\//i.test(url)
}

// ── Exact LinkedIn X-ray + intent queries, built from the Business profile.
export function buildLeadQueries(business) {
  const regions = business.regions?.length ? business.regions : ['India']
  const industry = business.idealCustomerProfile || (business.searchKeywords?.[0]) || 'startup'
  const keywords = (business.searchKeywords || []).slice(0, 3)
  const out = []

  for (const region of regions) {
    // Decision-makers on LinkedIn (public profiles via Google X-ray)
    out.push({ q: `site:linkedin.com/in ("founder" OR "co-founder" OR "CEO") "${industry}" "${region}"`, depth: 'advanced' })
    out.push({ q: `site:linkedin.com/in ("head of growth" OR "marketing manager" OR "CMO") "${industry}" ${region}`, depth: 'basic' })
    // Companies with buying signals
    out.push({ q: `site:linkedin.com/company "${industry}" ${region} ("seed" OR "series a" OR "hiring")`, depth: 'basic' })
    // Direct-contact intent
    out.push({ q: `"${industry}" ${region} founder email contact`, depth: 'basic' })
    for (const kw of keywords) {
      out.push({ q: `site:linkedin.com/in "${kw}" ${region} -recruiter -jobs`, depth: 'basic' })
    }
  }
  return out
}

async function extractLead(result, business) {
  const services = (business.services || []).join(', ') || 'custom software'
  const icp = business.idealCustomerProfile || 'small to mid-size businesses'

  const prompt = `You are screening a Google search result (often a public LinkedIn profile or company page) to build a B2B lead list. Extract the person/company and judge fit. Be reasonably generous.

WE SELL: ${services}
OUR IDEAL CUSTOMER: ${icp}
SELLER (reject if the result IS this company): ${business.name}

SEARCH RESULT:
Title: ${result.title}
URL: ${result.url}
Snippet: ${result.content}

Return ONLY valid JSON (no markdown):
{
  "relevant": true|false,
  "isCompetitor": true|false,
  "name": "person full name or null",
  "title": "job title or null",
  "company": "company name or null",
  "linkedinUrl": "linkedin profile/company url if in the result or null",
  "companyDomain": "company website domain if visible or null",
  "email": "email if explicitly present or null",
  "signal": "short buying signal, e.g. 'raised seed Mar 2026' or 'hiring 3 engineers'",
  "fitScore": 1-10,
  "summary": "1-2 sentence reason to reach out"
}`

  try {
    const res = await claude.messages.create({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    return JSON.parse(json)
  } catch (e) {
    console.error('[leadgen] extractLead parse failed:', e.message)
    return null
  }
}
