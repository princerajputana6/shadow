import { connectDB } from '@/lib/mongoose'
import AgentRun from '@/models/AgentRun'
import type { AgentName } from '@/models/AgentRun'

// Surface labels (what the user sees) mapped to internal AgentRun.agentName values.
// The "CEO / Orchestrator" surface is the Shadow assistant — it doesn't map to a
// stored run name; it routes work to specialists.

export type AgentRoleKey = 'ceo' | 'researcher' | 'cmo' | 'sales_rep' | 'dev' | 'data_analyst'

export type AgentRole = {
  key: AgentRoleKey
  name: string
  roleTitle: string          // small-caps subtitle
  description: string
  model: string
  /** Internal AgentRun.agentName this surface maps to, or null for the orchestrator. */
  backendAgentName: AgentName | null
  accent: string             // tailwind color name for the dot/glow
  icon: string               // emoji/glyph for chip
}

export type AgentDetail = {
  responsibilities: string[]
  outputs: string[]
  inputs: string[]
  collaboratesWith: AgentRoleKey[]
  voiceName: string  // hint for SpeechSynthesis voice selection
}

export const AGENT_DETAILS: Record<AgentRoleKey, AgentDetail> = {
  ceo: {
    responsibilities: [
      'Listens to the operator (voice or text) and routes work to the right specialist',
      'Reads every agent\'s run output and composes the daily debrief',
      'Triages new tasks — converts a vague ask into a structured plan',
      'Owns the morning briefing — single paragraph delivered at 6 AM IST',
      'Handles ambiguous requests by clarifying instead of guessing'
    ],
    outputs: ['Morning briefing', 'Task assignments', 'Routing decisions', 'Voice responses'],
    inputs: ['Operator commands (voice + text)', 'Other agents\' run results', 'Recent activity feed'],
    collaboratesWith: ['researcher', 'sales_rep', 'cmo', 'dev', 'data_analyst'],
    voiceName: 'Google US English'
  },
  researcher: {
    responsibilities: [
      'Runs intent-signal queries every 6 hours via Tavily',
      'Filters out competitors and listicles; keeps real buyer signals',
      'Enriches candidates with Hunter.io to find decision-maker emails',
      'Stages prospects into the review queue — never auto-contacts',
      'Hands qualified candidates to Sales Rep after operator approval'
    ],
    outputs: ['Candidate companies', 'Buyer-intent signals', 'Email enrichment'],
    inputs: ['Business profile from /businesses', 'Tavily search results', 'Hunter.io domain lookups'],
    collaboratesWith: ['sales_rep', 'ceo'],
    voiceName: 'Daniel'
  },
  cmo: {
    responsibilities: [
      'Drafts 5 posts per business per cycle — Twitter, LinkedIn, Instagram',
      'Calibrates tone to match your brand voice (educational, opinion, founder story)',
      'Respects platform character limits and visual norms',
      'Generates image prompts for Instagram posts',
      'Never auto-publishes — every post goes to your review queue'
    ],
    outputs: ['Post drafts', 'Image prompts', 'Suggested hashtags'],
    inputs: ['Business positioning', 'Recent customer wins', 'Industry conversations'],
    collaboratesWith: ['data_analyst', 'ceo'],
    voiceName: 'Samantha'
  },
  sales_rep: {
    responsibilities: [
      'Sends outreach to opted-in prospects via Gmail OAuth (no SMTP gymnastics)',
      'Reads replies, qualifies intent with Claude, de-duplicates threads',
      'Books meetings on Google Calendar with auto Meet links',
      'Updates the Lead pipeline with urgency scores',
      'After conversion, hands the engagement to Dev via CEO'
    ],
    outputs: ['Sent emails', 'Booked meetings', 'Qualified leads', 'Urgency scores'],
    inputs: ['Approved prospects', 'Inbox replies', 'Calendar availability'],
    collaboratesWith: ['researcher', 'data_analyst', 'dev', 'ceo'],
    voiceName: 'Google UK English Male'
  },
  dev: {
    responsibilities: [
      'Reads the GitHub repo tree (Octokit), walks files relevant to a task',
      'Generates code changes scoped to the smallest necessary diff',
      'Opens a DRAFT PR on a feature branch — never auto-merges',
      'Includes a summary, files-changed list, and reviewer checklist on every PR',
      'Picks up converted projects from Sales Rep via CEO routing'
    ],
    outputs: ['Draft pull requests', 'Code diffs', 'Implementation notes'],
    inputs: ['CTO plan', 'Repo tree', 'Task description', 'Source links (Jira / GitHub issues)'],
    collaboratesWith: ['data_analyst', 'ceo'],
    voiceName: 'Alex'
  },
  data_analyst: {
    responsibilities: [
      'Tracks per-agent run counts, failure rates, token consumption',
      'Surfaces anomalies — e.g. failure rate spike on the Dev agent',
      'Maintains the per-customer signal panel in the admin view',
      'Computes MRR / ARR / conversion ratios for the operator',
      'Assists Sales Rep with conversion analytics on request'
    ],
    outputs: ['Daily telemetry', 'Anomaly alerts', 'Per-customer reports', 'Conversion metrics'],
    inputs: ['Every AgentRun document', 'Lead pipeline', 'Subscription data'],
    collaboratesWith: ['sales_rep', 'cmo', 'dev', 'ceo'],
    voiceName: 'Google US English'
  }
}

export const AGENT_ROSTER: AgentRole[] = [
  {
    key: 'ceo',
    name: 'CEO',
    roleTitle: 'COMMAND LAYER',
    description: 'Routes work, reviews context, coordinates specialists, and returns the operator debrief.',
    model: 'gemini-2.0-flash',
    backendAgentName: null,
    accent: 'violet',
    icon: '◆'
  },
  {
    key: 'researcher',
    name: 'Researcher',
    roleTitle: 'INTEL GATHERER',
    description: 'Finds market signals, research briefs, sources, and strategic context.',
    model: 'gemini-2.0-flash',
    backendAgentName: 'sales_finder',  // Lead Discovery agent
    accent: 'sky',
    icon: '◎'
  },
  {
    key: 'cmo',
    name: 'CMO',
    roleTitle: 'MARKET VOICE',
    description: 'Turns strategy into content angles, campaigns, and publish-ready drafts.',
    model: 'gemini-2.0-flash',
    backendAgentName: 'social_media',
    accent: 'orange',
    icon: '☼'
  },
  {
    key: 'sales_rep',
    name: 'Sales Rep',
    roleTitle: 'REVENUE OPS',
    description: 'Qualifies leads, drafts outreach, and tracks follow-up opportunities.',
    model: 'gemini-2.0-flash',
    backendAgentName: 'sales_finder',
    accent: 'amber',
    icon: '✦'
  },
  {
    key: 'dev',
    name: 'Dev',
    roleTitle: 'BUILD SYSTEM',
    description: 'Builds dashboards, integrations, scripts, and ships technical changes.',
    model: 'gemini-2.0-flash',
    backendAgentName: 'developer',
    accent: 'emerald',
    icon: '◈'
  },
  {
    key: 'data_analyst',
    name: 'Data Analyst',
    roleTitle: 'SIGNAL LAYER',
    description: 'Analyses performance, trends, retention, and operational signal quality.',
    model: 'gemini-2.0-flash',
    backendAgentName: 'cto',
    accent: 'fuchsia',
    icon: '◇'
  }
]

export type AgentStatus = 'working' | 'idle' | 'failed' | 'never_run'

export type AgentStatusRow = AgentRole & {
  status: AgentStatus
  lastRunAt?: Date
  lastStats?: Record<string, unknown>
}

const RECENT_RUN_WINDOW_MS = 30 * 60_000  // 30 min — treat as "working"

export async function getRosterWithStatus(userId: string): Promise<AgentStatusRow[]> {
  await connectDB()
  // Get the latest AgentRun for each backend agent name in one round-trip.
  const cutoff = new Date(Date.now() - RECENT_RUN_WINDOW_MS)
  const recentRuns = await AgentRun.aggregate([
    { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId) } },
    { $sort: { startedAt: -1 } },
    { $group: { _id: '$agentName', latest: { $first: '$$ROOT' } } }
  ])
  const byName = new Map<string, { status: string; startedAt: Date; stats?: Record<string, unknown> }>()
  for (const r of recentRuns) {
    byName.set(r._id, { status: r.latest.status, startedAt: r.latest.startedAt, stats: r.latest.stats })
  }

  return AGENT_ROSTER.map((role) => {
    let status: AgentStatus = 'never_run'
    let lastRunAt: Date | undefined
    let lastStats: Record<string, unknown> | undefined

    if (!role.backendAgentName) {
      // Orchestrator — "working" if any backend agent ran recently
      const anyRecent = recentRuns.some(r =>
        r.latest.status === 'running' ||
        (r.latest.startedAt && new Date(r.latest.startedAt) > cutoff)
      )
      status = anyRecent ? 'working' : 'idle'
    } else {
      const hit = byName.get(role.backendAgentName)
      if (hit) {
        lastRunAt = hit.startedAt
        lastStats = hit.stats
        if (hit.status === 'running') status = 'working'
        else if (hit.status === 'failed') status = 'failed'
        else if (hit.startedAt > cutoff) status = 'working'
        else status = 'idle'
      }
    }
    return { ...role, status, lastRunAt, lastStats }
  })
}
