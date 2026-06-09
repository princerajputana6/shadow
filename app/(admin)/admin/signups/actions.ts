'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformAdmin } from '@/lib/access'
import { connectDB } from '@/lib/mongoose'
import SignupLead from '@/models/SignupLead'
import { createCompany } from '../actions'
import type { AgentKey } from '@/models/AgentSubscription'

const AGENT_KEYS_FROM_LABEL: Record<string, AgentKey> = {
  'Sales Rep': 'sales_finder',
  'Researcher': 'sales_finder',
  'CMO': 'social_media',
  'CTO + Dev': 'cto',
  'Dev': 'developer',
  'Dev only': 'developer'
}

export async function setSignupStatus(id: string, status: 'new' | 'contacted' | 'converted' | 'rejected') {
  await requirePlatformAdmin()
  await connectDB()
  await SignupLead.updateOne({ _id: id }, { status })
  revalidatePath('/admin/signups')
}

export async function convertSignupToCompany(id: string) {
  await requirePlatformAdmin()
  await connectDB()
  const lead = await SignupLead.findById(id).lean()
  if (!lead) throw new Error('Lead not found')

  // Convert interested-agent labels back to AgentKeys, default to nothing if unknown
  const agentSet = new Set<AgentKey>()
  for (const label of lead.interestedAgents || []) {
    const key = AGENT_KEYS_FROM_LABEL[label]
    if (key) agentSet.add(key)
  }
  // If they ticked nothing or unparseable, give them Sales Rep as default trial
  if (agentSet.size === 0) agentSet.add('sales_finder')

  const result = await createCompany({
    name: lead.company,
    ownerName: lead.name,
    ownerEmail: lead.email,
    website: lead.website,
    contactPhone: lead.phone,
    status: 'trial',
    enabledAgents: Array.from(agentSet)
  })

  await SignupLead.updateOne({ _id: id }, {
    status: 'converted',
    convertedOrgId: result.id
  })
  revalidatePath('/admin/signups')
  revalidatePath('/admin/companies')
  return result
}
