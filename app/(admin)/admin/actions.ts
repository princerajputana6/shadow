'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { requirePlatformAdmin } from '@/lib/access'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import Organization from '@/models/Organization'
import Membership from '@/models/Membership'
import AgentSubscription, { AGENT_CATALOG, type AgentKey } from '@/models/AgentSubscription'

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export async function createCompany(input: {
  name: string
  ownerName: string
  ownerEmail: string
  ownerPassword?: string
  website?: string
  industry?: string
  contactPhone?: string
  status?: 'active' | 'trial'
  enabledAgents: AgentKey[]
}) {
  await requirePlatformAdmin()
  await connectDB()

  const cleanEmail = input.ownerEmail.trim().toLowerCase()
  const cleanName = input.name.trim()
  if (!cleanName || !cleanEmail) throw new Error('Name and owner email are required')

  // Ensure unique slug
  let slug = slugify(cleanName)
  let suffix = 0
  while (await Organization.findOne({ slug })) { suffix++; slug = `${slugify(cleanName)}-${suffix}` }

  // Find or create the owner User
  let ownerUser = await User.findOne({ email: cleanEmail })
  if (!ownerUser) {
    const passwordHash = input.ownerPassword
      ? await bcrypt.hash(input.ownerPassword, 12)
      : undefined
    ownerUser = await User.create({
      email: cleanEmail,
      name: input.ownerName?.trim() || cleanEmail.split('@')[0],
      passwordHash,
      plan: 'client_basic'
    })
  }

  const org = await Organization.create({
    name: cleanName,
    slug,
    ownerUserId: ownerUser._id,
    contactEmail: cleanEmail,
    contactPhone: input.contactPhone,
    website: input.website,
    industry: input.industry,
    status: input.status || 'trial',
    trialEndsAt: input.status === 'active' ? undefined : new Date(Date.now() + 14 * 86400_000)
  })

  await Membership.findOneAndUpdate(
    { organizationId: org._id, userId: ownerUser._id },
    { organizationId: org._id, userId: ownerUser._id, role: 'owner' },
    { upsert: true }
  )

  // Create subscriptions: enabled ones priced at catalog default, others stay disabled.
  for (const a of AGENT_CATALOG) {
    const enabled = input.enabledAgents.includes(a.key)
    await AgentSubscription.create({
      organizationId: org._id,
      agentKey: a.key,
      enabled,
      monthlyPriceINR: enabled ? a.defaultPriceINR : 0,
      status: 'active'
    })
  }

  revalidatePath('/admin/companies')
  revalidatePath('/admin')
  return { id: String(org._id), slug: org.slug }
}

export async function updateAgentSubscription(orgId: string, agentKey: AgentKey, patch: {
  enabled?: boolean
  monthlyPriceINR?: number
  status?: 'active' | 'paused' | 'cancelled' | 'past_due'
}) {
  await requirePlatformAdmin()
  await connectDB()
  const sub = await AgentSubscription.findOne({ organizationId: orgId, agentKey })
  if (!sub) {
    await AgentSubscription.create({
      organizationId: orgId, agentKey,
      enabled: patch.enabled ?? false,
      monthlyPriceINR: patch.monthlyPriceINR ?? 0,
      status: patch.status ?? 'active'
    })
  } else {
    if (typeof patch.enabled === 'boolean') sub.enabled = patch.enabled
    if (typeof patch.monthlyPriceINR === 'number') sub.monthlyPriceINR = patch.monthlyPriceINR
    if (patch.status) sub.status = patch.status
    await sub.save()
  }
  revalidatePath(`/admin/companies/${orgId}`)
  revalidatePath('/admin/companies')
  revalidatePath('/admin')
}

export async function updateOrg(orgId: string, patch: {
  name?: string
  contactEmail?: string
  contactPhone?: string
  website?: string
  industry?: string
  status?: 'active' | 'trial' | 'suspended' | 'cancelled'
  notes?: string
}) {
  await requirePlatformAdmin()
  await connectDB()
  const org = await Organization.findById(orgId)
  if (!org) throw new Error('Not found')
  Object.assign(org, patch)
  await org.save()
  revalidatePath(`/admin/companies/${orgId}`)
  revalidatePath('/admin/companies')
}

export async function deleteCompany(orgId: string) {
  await requirePlatformAdmin()
  await connectDB()
  await AgentSubscription.deleteMany({ organizationId: orgId })
  await Membership.deleteMany({ organizationId: orgId })
  await Organization.deleteOne({ _id: orgId })
  revalidatePath('/admin/companies')
  revalidatePath('/admin')
}
