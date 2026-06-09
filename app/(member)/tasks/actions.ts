'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import Repo from '@/models/Repo'
import Task from '@/models/Task'
import { getCurrentOrg } from '@/lib/access'
import { listUserRepos } from '@/lib/github'

async function authedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

export async function syncRepos() {
  const userId = await authedUserId()
  await connectDB()
  const user = await User.findById(userId)
  const token = user?.githubTokens?.accessToken
  if (!token) throw new Error('GitHub not connected. Go to /settings.')
  const current = await getCurrentOrg(userId)
  if (!current) throw new Error('No organization')

  const repos = await listUserRepos(token, { perPage: 100 })
  for (const r of repos) {
    await Repo.findOneAndUpdate(
      { organizationId: current.org._id, fullName: r.full_name },
      {
        organizationId: current.org._id,
        connectedByUserId: userId,
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        defaultBranch: r.default_branch || 'main',
        isPrivate: r.private,
        lastSyncedAt: new Date()
      },
      { upsert: true, new: true }
    )
  }
  revalidatePath('/tasks')
  revalidatePath('/tasks/new')
  return { synced: repos.length }
}

export async function createTask(input: {
  title: string
  description?: string
  repoId?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  sourceLink?: string
}) {
  const userId = await authedUserId()
  await connectDB()
  const current = await getCurrentOrg(userId)
  if (!current) throw new Error('No organization')

  let repoUrl: string | undefined
  let branch: string | undefined
  if (input.repoId) {
    const repo = await Repo.findOne({ _id: input.repoId, organizationId: current.org._id })
    if (!repo) throw new Error('Repo not found')
    repoUrl = `https://github.com/${repo.fullName}`
    branch = repo.defaultBranch
  }

  const t = await Task.create({
    organizationId: current.org._id,
    createdByUserId: userId,
    title: input.title.trim(),
    description: input.description?.trim(),
    repoUrl,
    branch,
    priority: input.priority || 'normal',
    status: 'backlog',
    assignedAgent: 'cto',
    sourceLink: input.sourceLink
  })
  revalidatePath('/tasks')
  return { id: String(t._id) }
}

export async function triggerCto(taskId: string) {
  await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/cto/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ taskId })
  })
  if (!res.ok) throw new Error(`Runner ${res.status}: ${await res.text().catch(() => '')}`)
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/tasks')
}

export async function triggerDeveloper(taskId: string) {
  await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/developer/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ taskId })
  })
  if (!res.ok) throw new Error(`Runner ${res.status}: ${await res.text().catch(() => '')}`)
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/tasks')
}
