import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Prospect from '../models/Prospect.js'
import Reply from '../models/Reply.js'
import Lead from '../models/Lead.js'
import Meeting from '../models/Meeting.js'
import Briefing from '../models/Briefing.js'
import AgentRun from '../models/AgentRun.js'
import { sendOutreach, fetchReplies } from '../tools/gmailTool.js'
import { findFreeSlot, createMeeting } from '../tools/calendarTool.js'
import { readLeads, updateLeadStatus } from '../tools/sheetsTool.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'
const DAILY_OUTREACH_CAP = Number(process.env.DAILY_OUTREACH_CAP || 30) // warm list, not blast

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Best-effort CRM sheet status write — never breaks the run.
function crmStatus(user, email, status, extra) {
  if (!user.crmSheetId || !email || email.endsWith('@placeholder.invalid')) return
  updateLeadStatus(user.googleTokens, user.crmSheetId, email, status, extra)
    .catch((e) => console.warn('[sales] crm status update failed:', e.message))
}

// Pull owner approvals from the Google Sheet CRM into Mongo. A row whose Status
// is "Approved" flips its prospect to opted-in so it enters the outreach queue.
async function syncApprovalsFromSheet(user) {
  if (!user.crmSheetId) return 0
  let approved = 0
  try {
    const rows = await readLeads(user.googleTokens, user.crmSheetId)
    for (const row of rows) {
      if (row.status.toLowerCase() !== 'approved') continue
      const p = await Prospect.findOne({ userId: user._id, email: row.email })
      if (p && !p.consent?.granted) {
        p.consent = { granted: true, grantedAt: new Date(), source: 'sheet_approved' }
        p.source = 'opted_in'
        await p.save()
        approved++
      }
    }
  } catch (e) {
    console.error('[sales] approval sync failed:', e.message)
  }
  return approved
}

export async function runSalesAgent(userId) {
  await connectDB()
  const runStartedAt = new Date()
  const run = await AgentRun.create({
    userId, agentName: 'sales_finder', status: 'running', startedAt: runStartedAt
  })

  const stats = { approved: 0, contacted: 0, replies: 0, newLeads: 0, updatedLeads: 0, meetingsBooked: 0, skipped: 0 }

  try {
    const user = await User.findById(userId)
    if (!user) throw new Error(`user ${userId} not found`)
    const googleTokens = user.googleTokens
    if (!googleTokens?.refreshToken) {
      throw new Error('user has no Google refresh token — re-connect Google in /settings')
    }

    // ── 0. Pull "Approved" rows from the CRM sheet into the opted-in queue
    stats.approved = await syncApprovalsFromSheet(user)

    // ── 1. Outreach to OPTED-IN prospects only (Phase 1 adjustment #1)
    const optedIn = await Prospect.find({
      userId,
      status: 'not_contacted',
      'consent.granted': true,
      source: { $in: ['opted_in', 'referral'] }
    }).limit(DAILY_OUTREACH_CAP)

    for (const p of optedIn) {
      try {
        const { subject, body } = await composeOutreach(user, p)
        const { messageId, threadId } = await sendOutreach({
          googleTokens,
          fromEmail: user.email,
          fromName: user.name,
          to: p.email,
          subject,
          body
        })
        p.threadId = threadId
        p.status = 'contacted'
        p.contactedAt = new Date()
        await p.save()
        stats.contacted++
        crmStatus(user, p.email, 'Contacted', { nextStep: 'Awaiting reply' })
        await sleep(2500) // gentle pacing; warm list, no need for 30s
      } catch (e) {
        console.error(`[sales] outreach failed prospect=${p._id}:`, e.message)
        stats.skipped++
      }
    }

    // ── 2. Fetch replies (24h window)
    const replies = await fetchReplies({ googleTokens, sinceHours: 24, maxResults: 100 })
    stats.replies = replies.length

    // ── 3. Process each reply: dedupe by gmailMessageId, attach to Lead by threadId
    for (const r of replies) {
      try {
        // Skip if we already saw this exact message
        const seen = await Reply.findOne({ userId, gmailMessageId: r.gmailMessageId })
        if (seen) continue

        // Only process replies from prospects we actually contacted
        const prospect = await Prospect.findOne({
          userId,
          $or: [{ email: r.fromEmail }, { threadId: r.gmailThreadId }]
        })
        if (!prospect) {
          // Not from a tracked prospect — store for traceability but skip qualification
          await Reply.create({
            userId,
            gmailMessageId: r.gmailMessageId,
            gmailThreadId: r.gmailThreadId,
            fromEmail: r.fromEmail,
            fromName: r.fromName,
            subject: r.subject,
            body: r.body,
            receivedAt: r.receivedAt,
            processed: true,
            processedAt: new Date()
          })
          continue
        }

        prospect.status = 'replied'
        prospect.repliedAt = r.receivedAt
        await prospect.save()
        crmStatus(user, prospect.email, 'Replied', { nextStep: 'Qualifying' })

        const analysis = await qualifyReply(r)

        // Phase 1 adjustment #2: thread-aware dedupe
        let lead = await Lead.findOne({
          userId,
          $or: [
            { gmailThreadId: r.gmailThreadId },
            { prospectId: prospect._id },
            { email: r.fromEmail }
          ]
        })

        const isNewLead = !lead
        if (analysis?.interested) {
          if (!lead) {
            lead = await Lead.create({
              userId,
              prospectId: prospect._id,
              gmailThreadId: r.gmailThreadId,
              name: r.fromName || prospect.name,
              email: r.fromEmail,
              company: prospect.company,
              requirement: analysis.requirement || undefined,
              requirementDetail: analysis.requirementDetail || undefined,
              budget: analysis.budget || undefined,
              urgency: clampUrgency(analysis.urgency),
              status: 'new',
              lastReplyAt: r.receivedAt,
              lastAnalysis: analysis
            })
            stats.newLeads++
          } else {
            lead.requirement = analysis.requirement || lead.requirement
            lead.requirementDetail = analysis.requirementDetail || lead.requirementDetail
            lead.budget = analysis.budget || lead.budget
            lead.urgency = clampUrgency(analysis.urgency ?? lead.urgency)
            lead.lastReplyAt = r.receivedAt
            lead.lastAnalysis = analysis
            if (lead.status === 'new') lead.status = 'in_conversation'
            await lead.save()
            stats.updatedLeads++
          }

          // Book meeting only if not already scheduled
          const hasMeeting = await Meeting.findOne({
            userId, leadId: lead._id, status: { $in: ['scheduled', 'completed'] }
          })
          if (!hasMeeting && lead.status !== 'meeting_scheduled') {
            const booked = await tryBookMeeting({ user, lead, googleTokens })
            if (booked) {
              stats.meetingsBooked++
              crmStatus(user, lead.email, 'Booked', { nextStep: 'Meeting scheduled' })
            }
          }
        }

        await Reply.create({
          userId,
          prospectId: prospect._id,
          leadId: lead?._id,
          gmailMessageId: r.gmailMessageId,
          gmailThreadId: r.gmailThreadId,
          fromEmail: r.fromEmail,
          fromName: r.fromName,
          subject: r.subject,
          body: r.body,
          receivedAt: r.receivedAt,
          processed: true,
          processedAt: new Date(),
          aiAnalysis: analysis
        })
      } catch (e) {
        console.error(`[sales] reply failed id=${r.gmailMessageId}:`, e.message)
      }
    }

    // ── 4. Briefing — scope to this run, not by date string (review fix #4)
    const summary = await generateBriefing({ userId, runStartedAt, stats })

    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'completed',
      completedAt: new Date(),
      stats: { ...stats, briefingSummary: summary?.slice(0, 200) }
    })
    return stats
  } catch (err) {
    console.error(`[sales] run ${run._id} failed:`, err)
    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'failed', errorMessage: err.message, completedAt: new Date()
    })
    throw err
  }
}

function composeSubject(_user, prospect) {
  if (prospect.company) return `Quick idea for ${prospect.company}`
  return 'Following up on your interest'
}

function composeBody(user, prospect) {
  const firstName = prospect.name?.split(' ')[0] || 'there'
  const signoff = user.name ? `\n\nBest,\n${user.name}` : ''
  return `Hi ${firstName},

Following up as promised. We help teams ship custom software — websites, mobile apps, ERP, and AI-driven tooling.

If now's a good time to explore, reply with a couple of words about what you're trying to solve and I'll send back a 15-minute slot that works for you.

If now isn't right, just say "not now" and I'll close the loop.${signoff}`
}

// AI-personalized first-touch email. Uses the prospect's discovery signal to
// tailor the opener. Falls back to the static template on any failure so a
// send is never blocked by the model.
async function composeOutreach(user, prospect) {
  const fallback = { subject: composeSubject(user, prospect), body: composeBody(user, prospect) }
  const firstName = prospect.name?.split(' ')[0] || 'there'
  const signoff = user.name ? `\n\nBest,\n${user.name}` : ''

  const prompt = `Write a SHORT cold outreach email (B2B). Plain text, no markdown, max 90 words. Friendly, specific, not salesy. One clear ask: a quick 15-minute call. Do NOT invent facts.

SENDER sells: ${(user.searchProfile?.niche) || 'custom software development'}
RECIPIENT:
- Name: ${prospect.name || 'unknown'} (use first name "${firstName}")
- Company: ${prospect.company || 'their company'}
- Title: ${prospect.title || 'unknown'}
- Signal we noticed: ${prospect.discoverySignal || 'none'}

Return ONLY valid JSON (no markdown): {"subject": "...", "body": "..."}
The body must NOT include a sign-off (it is appended separately).`

  try {
    const res = await claude.messages.create({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim())
    if (json.subject && json.body) {
      return { subject: String(json.subject).slice(0, 120), body: `${json.body}${signoff}` }
    }
    return fallback
  } catch (e) {
    console.warn('[sales] composeOutreach fell back to template:', e.message)
    return fallback
  }
}

function clampUrgency(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 5
  return Math.max(1, Math.min(10, Math.round(x)))
}

async function qualifyReply(reply) {
  const prompt = `You are a sales qualification AI. Analyse this email reply and determine if the sender is genuinely interested in hiring a software development company.

Email reply:
---
From: ${reply.fromName || 'Unknown'} <${reply.fromEmail || ''}>
Subject: ${reply.subject || ''}
Body:
${reply.body || ''}
---

Return ONLY valid JSON (no explanation, no markdown):
{
  "interested": true|false,
  "reason": "one sentence",
  "requirement": "website"|"app"|"erp"|"ai"|"other"|null,
  "requirementDetail": "specific detail or null",
  "budget": "any budget mentioned or null",
  "urgency": 1-10,
  "intent": "wants_call"|"asking_questions"|"price_sensitive"|"opt_out"|"unclear"
}`

  try {
    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    // Strip code fences if Claude added them
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    return JSON.parse(json)
  } catch (e) {
    console.error('[sales] qualifyReply parse failed:', e.message)
    return null
  }
}

async function tryBookMeeting({ user, lead, googleTokens }) {
  const slot = await findFreeSlot({ googleTokens, durationMinutes: 30, daysAhead: 3 })
  if (!slot) {
    console.log(`[sales] no free slot for lead ${lead._id}`)
    return null
  }
  const meeting = await createMeeting({
    googleTokens,
    title: `Discovery call — ${lead.name || lead.email}${lead.company ? ` (${lead.company})` : ''}`,
    description: `Requirement: ${lead.requirementDetail || lead.requirement || 'Software development'}\n\nSent by Shadow's Sales Rep on behalf of ${user.name || user.email}.`,
    attendeeEmail: lead.email,
    attendeeName: lead.name || lead.email,
    startTime: slot.start,
    endTime: slot.end
  })
  await Meeting.create({
    userId: lead.userId,
    leadId: lead._id,
    title: `Discovery call — ${lead.name || lead.email}`,
    scheduledAt: new Date(slot.start),
    durationMinutes: 30,
    googleEventId: meeting.eventId,
    meetLink: meeting.meetLink,
    status: 'scheduled'
  })
  lead.status = 'meeting_scheduled'
  await lead.save()
  return meeting
}

async function generateBriefing({ userId, runStartedAt, stats }) {
  // Scope by run-start timestamp, not date string — avoids IST/UTC drift (review #4)
  const recentLeads = await Lead.find({
    userId, createdAt: { $gte: runStartedAt }
  }).sort({ urgency: -1, createdAt: -1 }).limit(5)

  const upcomingMeetings = await Meeting.find({
    userId,
    scheduledAt: { $gte: new Date(), $lt: new Date(Date.now() + 86400_000) },
    status: 'scheduled'
  }).sort({ scheduledAt: 1 })

  const prompt = `Generate a concise morning briefing for a business owner. Tone: professional, upbeat, like a smart assistant. 3-4 sentences. Lead with the most important number. Mention the highest-urgency lead by name if any. End on a motivating note. No bullet points, no markdown.

Last run stats:
- Contacted: ${stats.contacted}
- Replies received: ${stats.replies}
- New leads: ${stats.newLeads}
- Updated leads: ${stats.updatedLeads}
- Meetings booked: ${stats.meetingsBooked}

Top new leads:
${JSON.stringify(recentLeads.map((l) => ({ name: l.name, company: l.company, requirement: l.requirement, urgency: l.urgency })), null, 2)}

Today's meetings:
${JSON.stringify(upcomingMeetings.map((m) => ({ title: m.title, at: m.scheduledAt })), null, 2)}`

  let summaryText = ''
  try {
    const res = await claude.messages.create({
      model: MODEL, max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
    summaryText = res.content[0]?.type === 'text' ? res.content[0].text : ''
  } catch (e) {
    console.error('[sales] briefing generation failed:', e.message)
    summaryText = `Last night: ${stats.contacted} contacted, ${stats.newLeads} new leads, ${stats.meetingsBooked} meetings booked.`
  }

  // IST-local date string for the unique index
  const istNow = new Date(Date.now() + 5.5 * 3600_000)
  const date = istNow.toISOString().slice(0, 10)

  await Briefing.findOneAndUpdate(
    { userId, date },
    {
      userId, date,
      prospectsContacted: stats.contacted,
      repliesReceived: stats.replies,
      leadsQualified: stats.newLeads + stats.updatedLeads,
      meetingsBooked: stats.meetingsBooked,
      summaryText,
      leadsSnapshot: recentLeads,
      meetingsSnapshot: upcomingMeetings
    },
    { upsert: true, new: true }
  )
  return summaryText
}
