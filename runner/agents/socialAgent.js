import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Business from '../models/Business.js'
import SocialPost from '../models/SocialPost.js'
import AgentRun from '../models/AgentRun.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'

const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 1500,
  instagram: 2200
}

const DEFAULT_PLAN = [
  { platform: 'twitter', tone: 'opinion' },
  { platform: 'twitter', tone: 'founder_story' },
  { platform: 'linkedin', tone: 'case_study' },
  { platform: 'linkedin', tone: 'educational' },
  { platform: 'instagram', tone: 'question' }
]

export async function runSocialAgent(userId, { businessId } = {}) {
  await connectDB()
  const user = await User.findById(userId)
  if (!user) throw new Error(`user ${userId} not found`)

  const businesses = businessId
    ? await Business.find({ _id: businessId, userId, active: true })
    : await Business.find({ userId, active: true })
  if (!businesses.length) throw new Error('No active business found')

  const aggregateStats = { businessesProcessed: 0, postsDrafted: 0, failed: 0 }

  for (const business of businesses) {
    const run = await AgentRun.create({
      userId, businessId: business._id,
      agentName: 'social_media', status: 'running',
      stats: { mode: 'draft', business: business.name }
    })
    const stats = { postsDrafted: 0, failed: 0 }
    try {
      for (const { platform, tone } of DEFAULT_PLAN) {
        try {
          const draft = await draftPost({ business, platform, tone })
          if (!draft) { stats.failed++; continue }
          await SocialPost.create({
            userId, businessId: business._id,
            platform, tone,
            content: draft.content,
            hashtags: draft.hashtags,
            imagePrompt: draft.imagePrompt,
            status: 'draft'
          })
          stats.postsDrafted++
        } catch (e) {
          console.error(`[social] draft failed ${platform}/${tone}:`, e.message)
          stats.failed++
        }
      }
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'completed', completedAt: new Date(),
        stats: { ...stats, mode: 'draft', business: business.name }
      })
    } catch (err) {
      await AgentRun.findByIdAndUpdate(run._id, {
        status: 'failed', errorMessage: err.message, completedAt: new Date()
      })
    }
    aggregateStats.businessesProcessed++
    aggregateStats.postsDrafted += stats.postsDrafted
    aggregateStats.failed += stats.failed
  }

  return aggregateStats
}

async function draftPost({ business, platform, tone }) {
  const limit = PLATFORM_LIMITS[platform]
  const toneGuide = {
    educational: 'Teach one concrete tactic or insight your ICP would find useful. Specific > generic.',
    case_study: 'A short story-shaped post: situation, what we did, result. Use real-sounding numbers if you must invent them.',
    opinion: 'A confident, slightly contrarian take. Aim to spark replies.',
    founder_story: 'A behind-the-scenes founder POV — lesson learned, mistake, or small win.',
    question: 'A question that invites your ICP to share their experience.'
  }[tone]

  const prompt = `Draft ONE social post for ${business.name}, a B2B services company.

What they sell: ${business.services?.join(', ') || 'custom software'}
Ideal customer: ${business.idealCustomerProfile || 'SMBs needing custom software'}
Platform: ${platform} (max ${limit} characters)
Tone: ${tone} — ${toneGuide}

Rules:
- Stay strictly within ${limit} characters for the main content
- Do NOT start with "Excited to" or "We're thrilled" — those are dead phrases
- Do NOT use the company name in the first line
- Sound like a smart practitioner, not a marketer
- ${platform === 'twitter' ? 'Use 1-2 short lines, no hashtags inside the body.' : ''}
- ${platform === 'linkedin' ? 'Hook in the first line. Break into 3-4 short paragraphs. No emojis.' : ''}
- ${platform === 'instagram' ? 'Open with a hook. Brief paragraphs. Emojis OK if sparing.' : ''}

Return ONLY valid JSON (no markdown):
{
  "content": "the post text",
  "hashtags": ["max 4 tags appropriate for ${platform}, no # symbol"],
  "imagePrompt": "${platform === 'instagram' ? '1-sentence image prompt' : 'null'}"
}`

  const res = await claude.messages.create({
    model: MODEL, max_tokens: 800,
    messages: [{ role: 'user', content: prompt }]
  })
  const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  const parsed = JSON.parse(json)
  if (!parsed.content) return null
  if (parsed.content.length > limit) parsed.content = parsed.content.slice(0, limit - 1) + '…'
  return parsed
}
