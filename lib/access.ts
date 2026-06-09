import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import Organization from '@/models/Organization'
import Membership from '@/models/Membership'
import AgentSubscription, { AGENT_CATALOG, type AgentKey } from '@/models/AgentSubscription'

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  await connectDB()
  const user = await User.findById(session.user.id).lean()
  // Stale-JWT case: cookie still valid, but the user it points at is gone.
  // Going to /login would just bounce back (middleware sees the JWT as
  // authed) → loop. Force-clear the cookies via /api/auth/clear instead.
  if (!user) redirect('/api/auth/clear')
  return user
}

export async function requirePlatformAdmin() {
  const user = await getCurrentUser()
  if (!user.isPlatformAdmin) redirect('/dashboard')
  return user
}

// Returns the user's "current org" — for now the first membership, owner first.
export async function getCurrentOrg(userId: string) {
  await connectDB()
  const memberships = await Membership.find({ userId }).lean()
  if (!memberships.length) return null
  const ordered = memberships.sort((a, b) => {
    const score = (r: string) => r === 'owner' ? 0 : r === 'admin' ? 1 : 2
    return score(a.role) - score(b.role)
  })
  const org = await Organization.findById(ordered[0].organizationId).lean()
  return org ? { org, role: ordered[0].role as 'owner' | 'admin' | 'member' } : null
}

export async function getEnabledAgents(organizationId: string): Promise<Record<AgentKey, boolean>> {
  await connectDB()
  const subs = await AgentSubscription.find({ organizationId }).lean()
  const map = {} as Record<AgentKey, boolean>
  for (const a of AGENT_CATALOG) map[a.key] = false
  for (const s of subs) {
    if (s.enabled && s.status === 'active') map[s.agentKey as AgentKey] = true
  }
  return map
}
