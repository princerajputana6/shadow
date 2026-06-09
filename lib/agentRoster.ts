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

export const AGENT_ROSTER: AgentRole[] = [
  {
    key: 'ceo',
    name: 'CEO',
    roleTitle: 'COMMAND LAYER',
    description: 'Routes work, reviews context, coordinates specialists, and returns the operator debrief.',
    model: 'claude-haiku-4-5',
    backendAgentName: null,
    accent: 'violet',
    icon: '◆'
  },
  {
    key: 'researcher',
    name: 'Researcher',
    roleTitle: 'INTEL GATHERER',
    description: 'Finds market signals, research briefs, sources, and strategic context.',
    model: 'claude-haiku-4-5',
    backendAgentName: 'sales_finder',  // Lead Discovery agent
    accent: 'sky',
    icon: '◎'
  },
  {
    key: 'cmo',
    name: 'CMO',
    roleTitle: 'MARKET VOICE',
    description: 'Turns strategy into content angles, campaigns, and publish-ready drafts.',
    model: 'claude-haiku-4-5',
    backendAgentName: 'social_media',
    accent: 'orange',
    icon: '☼'
  },
  {
    key: 'sales_rep',
    name: 'Sales Rep',
    roleTitle: 'REVENUE OPS',
    description: 'Qualifies leads, drafts outreach, and tracks follow-up opportunities.',
    model: 'claude-haiku-4-5',
    backendAgentName: 'sales_finder',
    accent: 'amber',
    icon: '✦'
  },
  {
    key: 'dev',
    name: 'Dev',
    roleTitle: 'BUILD SYSTEM',
    description: 'Builds dashboards, integrations, scripts, and ships technical changes.',
    model: 'claude-sonnet-4',
    backendAgentName: 'developer',
    accent: 'emerald',
    icon: '◈'
  },
  {
    key: 'data_analyst',
    name: 'Data Analyst',
    roleTitle: 'SIGNAL LAYER',
    description: 'Analyses performance, trends, retention, and operational signal quality.',
    model: 'claude-haiku-4-5',
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
