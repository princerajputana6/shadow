import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Prospect from '@/models/Prospect'
import Lead from '@/models/Lead'
import Meeting from '@/models/Meeting'
import Briefing from '@/models/Briefing'
import AgentRun from '@/models/AgentRun'
import Reply from '@/models/Reply'
import Business from '@/models/Business'
import { claude, CLAUDE_MODEL } from '@/lib/anthropic'
import { retrieveMemories } from '@/lib/retrieval'
import { extractMemoriesFromChat } from '@/lib/memoryOps'

export const runtime = 'nodejs'

// Voice intent: "find leads for X" / "discover leads for X" / "search leads for X"
// Allows chained modifiers ("find me some new leads") and trims trailing politeness.
const FIND_LEADS_RX = /\b(?:find|discover|search|get|run discovery)(?:\s+(?:me|some|new|a|few|more))*\s+leads?(?:\s+for)?\s+(.+?)\s*[.?!]*\s*$/i
const TRAILING_NOISE_RX = /\s+(please|now|today|for me|thanks|thank you)$/i

async function tryTriggerDiscovery(userId: string, query: string) {
  const m = query.match(FIND_LEADS_RX)
  if (!m) return null
  let target = m[1].trim().toLowerCase().replace(/[^\w\s-.]/g, '').trim()
  // Strip trailing politeness ("biztreck please" → "biztreck")
  while (TRAILING_NOISE_RX.test(target)) target = target.replace(TRAILING_NOISE_RX, '').trim()
  await connectDB()
  const businesses = await Business.find({ userId, active: true }).lean()
  if (!businesses.length) {
    return { answer: 'I do not have any businesses configured yet. Add one at /businesses and I will find leads scoped to it.' }
  }
  // Match by slug, name, or substring
  const match = businesses.find(b =>
    b.slug === target ||
    b.name.toLowerCase() === target ||
    target.includes(b.slug) ||
    target.includes(b.name.toLowerCase())
  )
  if (!match) {
    const names = businesses.map(b => b.name).join(', ')
    return { answer: `I have ${businesses.length} business${businesses.length === 1 ? '' : 'es'}: ${names}. Which should I search for?` }
  }
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) {
    return { answer: 'I cannot reach the agent runner from here. Check AGENT_RUNNER_URL.' }
  }
  try {
    await fetch(`${runnerUrl}/agents/discovery/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
      body: JSON.stringify({ userId, businessId: String(match._id) })
    })
    return { answer: `On it. Running discovery for ${match.name}. Results will land in the discovery queue in a minute or two.` }
  } catch (e) {
    console.error('[assistant] discovery trigger failed:', e)
    return { answer: `I tried to start discovery for ${match.name} but the runner did not respond.` }
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const query: string = (body?.query || '').toString().slice(0, 500)
  if (!query) return NextResponse.json({ error: 'Empty query' }, { status: 400 })

  // Intent: explicit lead-finding command
  const action = await tryTriggerDiscovery(userId, query)
  if (action) return NextResponse.json(action)

  await connectDB()

  // ── Pull a snapshot of facts Shadow can speak to ───────────────────────
  const now = new Date()
  const startOfTodayIST = new Date(now.getTime() + 5.5 * 3600_000)
  startOfTodayIST.setUTCHours(0, 0, 0, 0)
  const startUTC = new Date(startOfTodayIST.getTime() - 5.5 * 3600_000)
  const last7d = new Date(now.getTime() - 7 * 86400_000)

  const [
    totalProspects, optedInProspects, contactedToday,
    totalLeads, newLeadsToday, newLeadsWeek, hotLeads,
    upcomingMeetings, meetingsToday,
    repliesToday,
    lastBriefing, lastSalesRun,
    businesses,
    // Hybrid retrieval — query-relevant memories ranked by importance + semantic similarity
    retrievalResult
  ] = await Promise.all([
    Prospect.countDocuments({ userId }),
    Prospect.countDocuments({ userId, 'consent.granted': true }),
    Prospect.countDocuments({ userId, contactedAt: { $gte: startUTC } }),
    Lead.countDocuments({ userId }),
    Lead.countDocuments({ userId, createdAt: { $gte: startUTC } }),
    Lead.countDocuments({ userId, createdAt: { $gte: last7d } }),
    Lead.find({ userId, urgency: { $gte: 7 } }).sort({ urgency: -1 }).limit(5)
      .select('name email company requirement urgency status').lean(),
    Meeting.find({ userId, scheduledAt: { $gte: now }, status: 'scheduled' })
      .sort({ scheduledAt: 1 }).limit(5)
      .select('title scheduledAt meetLink').lean(),
    Meeting.countDocuments({ userId, scheduledAt: { $gte: startUTC, $lt: new Date(startUTC.getTime() + 86400_000) } }),
    Reply.countDocuments({ userId, receivedAt: { $gte: startUTC } }),
    Briefing.findOne({ userId }).sort({ createdAt: -1 }).lean(),
    AgentRun.findOne({ userId, agentName: 'sales_finder' }).sort({ startedAt: -1 }).lean(),
    Business.find({ userId, active: true }).select('name slug services').lean(),
    retrieveMemories(userId, query, { limit: 10, expand: true, rerank: true, compress: true }).catch(() => ({
      memories: [], context: ''
    }))
  ])

  const { memories: rankedMemories, context: memoryContext } = retrievalResult

  const facts = {
    today: startOfTodayIST.toISOString().slice(0, 10),
    counts: {
      totalProspects, optedInProspects, contactedToday,
      totalLeads, newLeadsToday, newLeadsWeek,
      repliesToday, meetingsToday
    },
    hotLeads: hotLeads.map(l => ({
      name: l.name, company: l.company, requirement: l.requirement, urgency: l.urgency, status: l.status
    })),
    upcomingMeetings: upcomingMeetings.map(m => ({
      title: m.title, at: m.scheduledAt, meetLink: m.meetLink
    })),
    lastBriefing: lastBriefing ? {
      date: lastBriefing.date,
      summary: lastBriefing.summaryText
    } : null,
    lastSalesRun: lastSalesRun ? {
      status: lastSalesRun.status,
      startedAt: lastSalesRun.startedAt,
      stats: lastSalesRun.stats
    } : null,
    businesses: businesses.map(b => ({ name: b.name, slug: b.slug, services: b.services })),
    memories: rankedMemories.map(m => ({ key: m.key, value: m.value, type: m.type, importance: m.importance })),
    memoryContext
  }

  const memBlock = facts.memoryContext
    ? `RELEVANT MEMORIES (compressed):\n${facts.memoryContext}`
    : facts.memories.length
    ? `MEMORIES:\n${facts.memories.map((m: { key: string; value: string }) => `${m.key}: ${m.value}`).join('\n')}`
    : ''

  const prompt = `You are Shadow, the user's AI operations assistant. The user spoke (or typed) a question. Answer conversationally in 1-3 short sentences, using the facts below — including the stored memories about the user/business, which you should treat as ground truth and draw on whenever relevant. Speak in first person ("You have…", "I booked…"). Do not list bullet points — this is going to be spoken aloud. If asked for "today's update", give the punchiest version: contacted/replies/new leads/meetings. If a fact is missing or zero, be honest ("nothing yet today").

USER QUESTION: ${query}

${memBlock}

OPERATIONAL FACTS (JSON):
${JSON.stringify({ ...facts, memories: undefined, memoryContext: undefined }, null, 2)}

Reply with just the spoken answer. No preamble.`

  try {
    const res = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = res.content[0]
    const answer = block?.type === 'text' ? block.text.trim() : 'I could not produce an answer.'

    // Async: extract any durable facts from this turn and store as memories (fire-and-forget)
    extractMemoriesFromChat(userId, query, answer).catch(() => {})

    return NextResponse.json({ answer, facts })
  } catch (e) {
    console.error('[assistant] claude failed:', e)
    return NextResponse.json({
      answer: fallbackAnswer(facts),
      facts
    })
  }
}

function fallbackAnswer(f: { counts: Record<string, number> }) {
  const c = f.counts
  return `Today so far: ${c.contactedToday} contacted, ${c.repliesToday} replies, ${c.newLeadsToday} new leads, ${c.meetingsToday} meetings on the calendar.`
}
