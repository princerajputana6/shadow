import { connectDB } from '@/lib/mongoose'
import Organization from '@/models/Organization'
import Membership from '@/models/Membership'
import AgentSubscription, { AGENT_CATALOG } from '@/models/AgentSubscription'
import AgentRun from '@/models/AgentRun'
import User from '@/models/User'

// Rough token-per-run estimates (we don't track exact yet)
const TOKENS_PER_RUN: Record<string, number> = {
  sales_finder: 1800,
  social_media: 2400,
  cto: 2200,
  developer: 5500
}

export type CustomerSummary = {
  orgId: string
  name: string
  status: string
  contactEmail: string
  createdAt: Date
  members: number
  enabledAgents: number
  mrrINR: number
  runs7d: number
  runsTotal: number
  failures7d: number
  tokensEstimate: number
  lastActivity?: Date
}

export type AdminSnapshot = {
  totals: {
    customers: number
    activeCustomers: number
    trialCustomers: number
    suspendedCustomers: number
    cancelledCustomers: number
    payingCustomers: number
    users: number
    mrrINR: number
    arrINR: number
    runs24h: number
    runs7d: number
    runsTotal: number
    failures7d: number
    tokensTotal: number
  }
  agentAdoption: {
    key: string
    name: string
    activeSubs: number
    mrrINR: number
  }[]
  agentUsage: {
    key: string
    name: string
    runs: number
    failures: number
  }[]
  recentFailures: {
    orgName: string
    agentName: string
    startedAt: Date
    errorMessage?: string
  }[]
  customers: CustomerSummary[]
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  await connectDB()
  const now = new Date()
  const day = 86400_000
  const since24h = new Date(now.getTime() - day)
  const since7d = new Date(now.getTime() - 7 * day)

  // Exclude internal "Shadow HQ" org from customer-facing analytics — it's
  // the admin's own dogfooding org, not a customer.
  const [orgs, allSubs, allUsers, allMemberships] = await Promise.all([
    Organization.find({ slug: { $nin: ['shadow-hq', 'agentos-hq'] } }).sort({ createdAt: -1 }).lean(),
    AgentSubscription.find({}).lean(),
    User.countDocuments({}),
    Membership.find({}).lean()
  ])

  const membersByOrg = new Map<string, number>()
  for (const m of allMemberships) {
    const k = String(m.organizationId)
    membersByOrg.set(k, (membersByOrg.get(k) || 0) + 1)
  }

  const subsByOrg = new Map<string, { enabled: number; mrr: number }>()
  const adoptionByAgent = new Map<string, { activeSubs: number; mrrINR: number }>()
  for (const a of AGENT_CATALOG) adoptionByAgent.set(a.key, { activeSubs: 0, mrrINR: 0 })

  for (const s of allSubs) {
    if (!(s.enabled && s.status === 'active')) continue
    const k = String(s.organizationId)
    const row = subsByOrg.get(k) || { enabled: 0, mrr: 0 }
    row.enabled++
    row.mrr += s.monthlyPriceINR || 0
    subsByOrg.set(k, row)
    const agentRow = adoptionByAgent.get(s.agentKey)
    if (agentRow) {
      agentRow.activeSubs++
      agentRow.mrrINR += s.monthlyPriceINR || 0
    }
  }

  // Aggregate per-org AgentRun stats in one pass
  const runAgg = await AgentRun.aggregate([
    {
      $facet: {
        last24h: [
          { $match: { startedAt: { $gte: since24h } } },
          { $group: { _id: '$userId', count: { $sum: 1 } } }
        ],
        last7d: [
          { $match: { startedAt: { $gte: since7d } } },
          { $group: {
              _id: { userId: '$userId', agentName: '$agentName' },
              count: { $sum: 1 },
              failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } }
          } }
        ],
        total: [
          { $group: { _id: '$userId', count: { $sum: 1 } } }
        ],
        latestByUser: [
          { $sort: { startedAt: -1 } },
          { $group: { _id: '$userId', latest: { $first: '$startedAt' } } }
        ],
        recentFails: [
          { $match: { status: 'failed', startedAt: { $gte: since7d } } },
          { $sort: { startedAt: -1 } },
          { $limit: 20 }
        ]
      }
    }
  ])
  const facets = runAgg[0] || {}
  const last24hByUser = new Map<string, number>((facets.last24h || []).map((r: { _id: unknown; count: number }) => [String(r._id), r.count]))
  const last7dByUserAgent = new Map<string, { count: number; failures: number; agent: string; user: string }>()
  for (const r of (facets.last7d || [])) {
    const key = `${String(r._id.userId)}::${r.agentName}`
    last7dByUserAgent.set(key, { count: r.count, failures: r.failures, agent: r._id.agentName, user: String(r._id.userId) })
  }
  const totalByUser = new Map<string, number>((facets.total || []).map((r: { _id: unknown; count: number }) => [String(r._id), r.count]))
  const latestByUser = new Map<string, Date>((facets.latestByUser || []).map((r: { _id: unknown; latest: Date }) => [String(r._id), r.latest]))

  // Per-customer rollup — userId → org via Membership where role = owner.
  // For simplicity, map userId to first org we find in memberships.
  const userToOrg = new Map<string, string>()
  for (const m of allMemberships) userToOrg.set(String(m.userId), String(m.organizationId))

  const runs7dByOrg = new Map<string, number>()
  const failures7dByOrg = new Map<string, number>()
  const tokensByOrg = new Map<string, number>()
  const agentUsageMap = new Map<string, { runs: number; failures: number }>()
  for (const a of AGENT_CATALOG) agentUsageMap.set(a.key, { runs: 0, failures: 0 })

  for (const [, row] of last7dByUserAgent.entries()) {
    const orgId = userToOrg.get(row.user)
    if (orgId) {
      runs7dByOrg.set(orgId, (runs7dByOrg.get(orgId) || 0) + row.count)
      failures7dByOrg.set(orgId, (failures7dByOrg.get(orgId) || 0) + row.failures)
      const tpr = TOKENS_PER_RUN[row.agent] || 2000
      tokensByOrg.set(orgId, (tokensByOrg.get(orgId) || 0) + row.count * tpr)
    }
    const agg = agentUsageMap.get(row.agent)
    if (agg) { agg.runs += row.count; agg.failures += row.failures }
  }

  const customers: CustomerSummary[] = orgs.map((o) => {
    const key = String(o._id)
    const sub = subsByOrg.get(key) || { enabled: 0, mrr: 0 }
    return {
      orgId: key,
      name: o.name,
      status: o.status,
      contactEmail: o.contactEmail,
      createdAt: o.createdAt,
      members: membersByOrg.get(key) || 0,
      enabledAgents: sub.enabled,
      mrrINR: sub.mrr,
      runs7d: runs7dByOrg.get(key) || 0,
      runsTotal: 0,
      failures7d: failures7dByOrg.get(key) || 0,
      tokensEstimate: tokensByOrg.get(key) || 0,
      lastActivity: undefined as Date | undefined
    }
  })

  // Fill in totals + last activity by walking memberships for each org
  for (const m of allMemberships) {
    const orgId = String(m.organizationId)
    const userId = String(m.userId)
    const cust = customers.find(c => c.orgId === orgId)
    if (!cust) continue
    cust.runsTotal += totalByUser.get(userId) || 0
    const last = latestByUser.get(userId)
    if (last && (!cust.lastActivity || new Date(last) > new Date(cust.lastActivity))) {
      cust.lastActivity = last
    }
  }

  const recentFailures = (facets.recentFails || []).map((f: { agentName: string; startedAt: Date; userId: unknown; errorMessage?: string }) => {
    const orgId = userToOrg.get(String(f.userId))
    const org = orgs.find(o => String(o._id) === orgId)
    return {
      orgName: org?.name || 'Unknown',
      agentName: f.agentName,
      startedAt: f.startedAt,
      errorMessage: f.errorMessage
    }
  })

  const mrrINR = customers.reduce((s, c) => s + c.mrrINR, 0)
  const totalRuns24h = Array.from(last24hByUser.values()).reduce((s, x) => s + x, 0)
  const totalRuns7d = customers.reduce((s, c) => s + c.runs7d, 0)
  const totalRunsTotal = customers.reduce((s, c) => s + c.runsTotal, 0)
  const totalFailures7d = customers.reduce((s, c) => s + c.failures7d, 0)
  const totalTokens = customers.reduce((s, c) => s + c.tokensEstimate, 0)

  return {
    totals: {
      customers: customers.length,
      activeCustomers: customers.filter(c => c.status === 'active').length,
      trialCustomers: customers.filter(c => c.status === 'trial').length,
      suspendedCustomers: customers.filter(c => c.status === 'suspended').length,
      cancelledCustomers: customers.filter(c => c.status === 'cancelled').length,
      payingCustomers: customers.filter(c => c.mrrINR > 0).length,
      users: allUsers,
      mrrINR,
      arrINR: mrrINR * 12,
      runs24h: totalRuns24h,
      runs7d: totalRuns7d,
      runsTotal: totalRunsTotal,
      failures7d: totalFailures7d,
      tokensTotal: totalTokens
    },
    agentAdoption: AGENT_CATALOG.map(a => ({
      key: a.key,
      name: a.name,
      activeSubs: adoptionByAgent.get(a.key)?.activeSubs || 0,
      mrrINR: adoptionByAgent.get(a.key)?.mrrINR || 0
    })),
    agentUsage: AGENT_CATALOG.map(a => ({
      key: a.key,
      name: a.name,
      runs: agentUsageMap.get(a.key)?.runs || 0,
      failures: agentUsageMap.get(a.key)?.failures || 0
    })),
    recentFailures,
    customers
  }
}
