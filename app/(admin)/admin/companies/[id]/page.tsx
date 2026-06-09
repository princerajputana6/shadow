import { notFound } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Organization from '@/models/Organization'
import Membership from '@/models/Membership'
import User from '@/models/User'
import AgentSubscription, { AGENT_CATALOG } from '@/models/AgentSubscription'
import AgentRun from '@/models/AgentRun'
import { CompanyDetail } from './_components/CompanyDetail'
import { CompanyUsageRow } from './_components/CompanyUsageRow'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const TOKENS_PER_RUN: Record<string, number> = {
  sales_finder: 1800,
  social_media: 2400,
  cto: 2200,
  developer: 5500
}

export default async function CompanyPage({ params }: { params: { id: string } }) {
  await connectDB()
  const org = await Organization.findById(params.id).lean()
  if (!org) notFound()

  const [memberships, subs] = await Promise.all([
    Membership.find({ organizationId: org._id }).lean(),
    AgentSubscription.find({ organizationId: org._id }).lean()
  ])
  const userIds = memberships.map(m => m.userId)
  const users = await User.find({ _id: { $in: userIds } })
    .select('name email googleTokens.scope githubTokens.login bitbucketTokens.username jiraTokens.cloudId')
    .lean()
  const userMap = new Map(users.map(u => [String(u._id), u]))

  // Usage metrics — aggregate AgentRun for any user in this org
  const since7d = new Date(Date.now() - 7 * 86400_000)
  const runsAgg = await AgentRun.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $facet: {
      total: [
        { $group: { _id: '$agentName', count: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }
      ],
      last7d: [
        { $match: { startedAt: { $gte: since7d } } },
        { $group: { _id: '$agentName', count: { $sum: 1 }, failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } }
      ],
      latest: [
        { $sort: { startedAt: -1 } },
        { $limit: 5 },
        { $project: { agentName: 1, status: 1, startedAt: 1, errorMessage: 1, stats: 1 } }
      ]
    } }
  ])
  const facets = runsAgg[0] || {}
  type RunGroup = { _id: string; count: number; failures: number }
  const totalRuns = (facets.total as RunGroup[] || []).reduce((s, r) => s + r.count, 0)
  const totalFailures = (facets.total as RunGroup[] || []).reduce((s, r) => s + r.failures, 0)
  const runs7d = (facets.last7d as RunGroup[] || []).reduce((s, r) => s + r.count, 0)
  const failures7d = (facets.last7d as RunGroup[] || []).reduce((s, r) => s + r.failures, 0)
  const tokensEstimate = (facets.total as RunGroup[] || []).reduce(
    (s, r) => s + (TOKENS_PER_RUN[r._id] || 2000) * r.count, 0)
  const latestRuns = (facets.latest as { agentName: string; status: string; startedAt: Date; errorMessage?: string; stats?: Record<string, unknown> }[]) || []

  // Integration status — pull from first member's tokens (typically the owner)
  const owner = userMap.get(String(memberships.find(m => m.role === 'owner')?.userId)) as Record<string, unknown> | undefined
  const integrations = {
    google: !!(owner?.googleTokens as { scope?: string } | undefined)?.scope,
    github: !!(owner?.githubTokens as { login?: string } | undefined)?.login,
    bitbucket: !!(owner?.bitbucketTokens as { username?: string } | undefined)?.username,
    jira: !!(owner?.jiraTokens as { cloudId?: string } | undefined)?.cloudId
  }

  const subsByKey = new Map(subs.map(s => [s.agentKey, s]))
  const agentRows = AGENT_CATALOG.map(a => ({
    ...a,
    sub: subsByKey.get(a.key) ?? null
  }))

  const membersList = memberships.map(m => ({
    role: m.role,
    user: userMap.get(String(m.userId))
  }))

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted"><Link href="/admin/companies" className="hover:text-text">← Companies</Link></p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{org.name}</h1>
          <p className="text-sm text-muted">{org.contactEmail}</p>
        </div>
      </header>

      <CompanyUsageRow
        totalRuns={totalRuns}
        totalFailures={totalFailures}
        runs7d={runs7d}
        failures7d={failures7d}
        tokensEstimate={tokensEstimate}
        integrations={integrations}
        latestRuns={latestRuns as never}
      />

      {/* @ts-expect-error — Mongoose lean output widens types */}
      <CompanyDetail org={org} agentRows={agentRows} members={membersList} />
    </div>
  )
}
