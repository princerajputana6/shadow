'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import SocialPost from '@/models/SocialPost'

async function authedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

export async function approvePost(id: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await SocialPost.findOne({ _id: id, userId })
  if (!p) throw new Error('Not found')
  p.status = 'approved'
  await p.save()
  revalidatePath('/social')
}

export async function rejectPost(id: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await SocialPost.findOne({ _id: id, userId })
  if (!p) throw new Error('Not found')
  p.status = 'rejected'
  await p.save()
  revalidatePath('/social')
}

export async function updatePostContent(id: string, content: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await SocialPost.findOne({ _id: id, userId })
  if (!p) throw new Error('Not found')
  p.content = content
  await p.save()
  revalidatePath('/social')
}

export async function markPosted(id: string, externalId?: string) {
  const userId = await authedUserId()
  await connectDB()
  const p = await SocialPost.findOne({ _id: id, userId })
  if (!p) throw new Error('Not found')
  p.status = 'posted'
  p.postedAt = new Date()
  if (externalId) p.externalId = externalId
  await p.save()
  revalidatePath('/social')
}

export async function triggerSocialDraft() {
  const userId = await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/social/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ userId })
  })
  if (!res.ok) throw new Error(`Runner ${res.status}: ${await res.text().catch(() => '')}`)
  revalidatePath('/social')
}
