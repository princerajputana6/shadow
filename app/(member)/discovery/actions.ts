'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Prospect from '@/models/Prospect'

async function authedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

export async function approveProspect(prospectId: string, email?: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await Prospect.findOne({ _id: prospectId, userId })
  if (!p) throw new Error('Not found')
  if (email && /\S+@\S+\.\S+/.test(email)) p.email = email.toLowerCase()
  if (p.email.endsWith('@placeholder.invalid')) {
    throw new Error('Add a real email before approving — outreach needs a deliverable address.')
  }
  p.consent = { granted: true, grantedAt: new Date(), source: 'owner_approved_from_discovery' }
  p.source = 'opted_in' // it becomes part of the outreach queue
  await p.save()
  revalidatePath('/discovery')
}

export async function rejectProspect(prospectId: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await Prospect.findOne({ _id: prospectId, userId })
  if (!p) throw new Error('Not found')
  p.status = 'disqualified'
  await p.save()
  revalidatePath('/discovery')
}

export async function triggerDiscoveryRun() {
  const userId = await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/discovery/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ userId })
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Runner ${res.status}: ${detail}`)
  }
  revalidatePath('/discovery')
}

export async function triggerLeadgenRun() {
  const userId = await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/leadgen/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ userId })
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Runner ${res.status}: ${detail}`)
  }
  revalidatePath('/discovery')
}

export async function triggerEnrichment() {
  const userId = await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/enrich/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ userId })
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Runner ${res.status}: ${detail}`)
  }
  revalidatePath('/discovery')
}
