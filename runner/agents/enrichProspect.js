// Bulk enrichment job — for every prospect with a placeholder email and a
// discovery URL (or company website), call Hunter.io and replace the placeholder.
//
// Triggered manually from /discovery via the "Enrich emails" button.

import { connectDB } from '../lib/mongoose.js'
import Prospect from '../models/Prospect.js'
import AgentRun from '../models/AgentRun.js'
import { hunterDomainSearch, domainFromUrl, isPlaceholderEmail } from '../tools/hunterTool.js'

export async function runEnrichment(userId, { businessId } = {}) {
  await connectDB()
  // Create the AgentRun row first so failures (missing key, etc.) are visible
  // in the UI/poll instead of silently throwing.
  const run = await AgentRun.create({
    userId, businessId, agentName: 'sales_finder', status: 'running',
    stats: { mode: 'enrichment' }
  })

  if (!process.env.HUNTER_API_KEY) {
    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'failed',
      errorMessage: 'HUNTER_API_KEY not set — add it in runner/.env',
      completedAt: new Date(),
      stats: { mode: 'enrichment', scanned: 0, enriched: 0, missed: 0, errors: 1 }
    })
    throw new Error('HUNTER_API_KEY not set — add it in /settings or runner/.env')
  }

  const filter = { userId, source: 'discovered' }
  if (businessId) filter.businessId = businessId
  filter.email = /@placeholder\.invalid$/

  const candidates = await Prospect.find(filter).limit(25) // respect free tier
  const stats = { scanned: candidates.length, enriched: 0, missed: 0, errors: 0 }

  for (const p of candidates) {
    try {
      const tryDomains = [
        domainFromUrl(p.discoveryUrl),
        p.company ? `${p.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : null
      ].filter(Boolean)
      let hit = null
      for (const d of tryDomains) {
        hit = await hunterDomainSearch(d).catch(() => null)
        if (hit?.email) break
      }
      if (hit?.email) {
        p.email = hit.email
        if (!p.name) p.name = [hit.firstName, hit.lastName].filter(Boolean).join(' ')
        await p.save()
        stats.enriched++
      } else {
        stats.missed++
      }
    } catch (e) {
      console.warn('[enrich] failed:', e.message)
      stats.errors++
    }
  }

  await AgentRun.findByIdAndUpdate(run._id, {
    status: 'completed', completedAt: new Date(),
    stats: { ...stats, mode: 'enrichment' }
  })
  return stats
}
