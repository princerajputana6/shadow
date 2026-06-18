import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import Task from '../models/Task.js'
import Repo from '../models/Repo.js'
import User from '../models/User.js'
import AgentRun from '../models/AgentRun.js'
import { getRepoTree, shortFilesByExtension } from '../tools/githubTool.js'

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'
const PLANNING_MODEL = process.env.CLAUDE_PLANNING_MODEL || MODEL  // Sonnet recommended

// CTO triage:
//   1. Mark task as triaging
//   2. If task has a repo, fetch the file tree
//   3. Ask Claude to produce a plan + list of files to read & modify
//   4. Save ctoPlan, mark in_progress, assigned to developer

export async function runCtoAgent(taskId) {
  await connectDB()
  const task = await Task.findById(taskId)
  if (!task) throw new Error('Task not found')

  const run = await AgentRun.create({
    userId: task.createdByUserId, organizationId: task.organizationId,
    businessId: undefined, agentName: 'cto', status: 'running',
    stats: { taskId: String(task._id), title: task.title }
  })

  task.status = 'triaging'
  task.startedAt = new Date()
  await task.save()

  try {
    let tree = null
    let owner, repoName, branch

    if (task.repoUrl) {
      const match = task.repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/)
      if (!match) throw new Error(`Could not parse repo URL: ${task.repoUrl}`)
      ;[, owner, repoName] = match

      // Find a User with GitHub access to this repo's org
      const repo = await Repo.findOne({ organizationId: task.organizationId, fullName: `${owner}/${repoName}` })
      if (!repo) throw new Error(`Repo not connected: ${owner}/${repoName}. Sync repos at /tasks.`)
      branch = repo.defaultBranch || 'main'
      task.branch = branch

      const user = await User.findById(repo.connectedByUserId)
      const token = user?.githubTokens?.accessToken
      if (!token) throw new Error('GitHub token missing on connecting user')

      const t = await getRepoTree(token, owner, repoName, branch)
      tree = { commitSha: t.commitSha, files: shortFilesByExtension(t.files) }
    }

    const prompt = buildPrompt(task, tree)
    const res = await claude.messages.create({
      model: PLANNING_MODEL, max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = res.content[0]?.type === 'text' ? res.content[0].text : ''
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    let plan
    try { plan = JSON.parse(json) } catch (e) {
      throw new Error(`CTO plan was not valid JSON: ${text.slice(0, 200)}`)
    }
    if (!plan.summary) throw new Error('CTO plan missing summary')

    const planMarkdown = renderPlan(plan)
    task.ctoPlan = planMarkdown
    task.assignedAgent = 'developer'
    task.status = 'in_progress'
    if (Array.isArray(plan.filesToRead)) {
      task.set('developerNotes', undefined) // clear stale notes
    }
    await task.save()

    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'completed', completedAt: new Date(),
      stats: { taskId: String(task._id), targetFiles: plan.filesToModify?.length || 0 }
    })
    return { ok: true, plan }
  } catch (err) {
    task.errorMessage = err.message
    task.status = 'blocked'
    await task.save()
    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'failed', errorMessage: err.message, completedAt: new Date()
    })
    throw err
  }
}

function buildPrompt(task, tree) {
  const repoContext = tree
    ? `\n\nRepository tree (filtered to ~${tree.files.length} code/doc files):\n${tree.files.slice(0, 400).map(f => `- ${f.path}`).join('\n')}`
    : '\n\n(No repo attached to this task — produce a plan only.)'

  return `You are a senior engineering leader (CTO) triaging an incoming task.

TASK
Title: ${task.title}
Priority: ${task.priority}
Description:
${task.description || '(no description)'}

${repoContext}

Produce a structured triage plan. Be specific: pick the files that look most relevant from the tree above, justify each pick in one line, and explain the change. If the task is unclear or impossible from the tree, set "blocked" with a reason.

Return ONLY valid JSON (no markdown, no preamble):
{
  "summary": "2-3 sentence plain-English summary of the change",
  "approach": "1-2 paragraphs explaining how you would implement it",
  "filesToRead": ["max 8 files to read for context, by path"],
  "filesToModify": ["max 6 files that will actually change, by path"],
  "newFiles": ["any new files to create with paths, max 3"],
  "risks": ["short list of risks or open questions"],
  "blocked": false,
  "blockedReason": null
}`
}

function renderPlan(plan) {
  const lines = []
  lines.push(`## Summary`)
  lines.push(plan.summary || '')
  lines.push('')
  if (plan.approach) {
    lines.push(`## Approach`)
    lines.push(plan.approach)
    lines.push('')
  }
  if (plan.filesToRead?.length) {
    lines.push(`## Files to read`)
    for (const f of plan.filesToRead) lines.push(`- \`${f}\``)
    lines.push('')
  }
  if (plan.filesToModify?.length) {
    lines.push(`## Files to modify`)
    for (const f of plan.filesToModify) lines.push(`- \`${f}\``)
    lines.push('')
  }
  if (plan.newFiles?.length) {
    lines.push(`## New files`)
    for (const f of plan.newFiles) lines.push(`- \`${f}\``)
    lines.push('')
  }
  if (plan.risks?.length) {
    lines.push(`## Risks`)
    for (const r of plan.risks) lines.push(`- ${r}`)
    lines.push('')
  }
  if (plan.blocked) {
    lines.push(`## Blocked`)
    lines.push(plan.blockedReason || 'Reason not given')
  }
  // Stash structured data as a JSON code block at the bottom so Developer can re-read it
  lines.push('')
  lines.push('<!-- AGENTOS_PLAN_JSON')
  lines.push(JSON.stringify({
    filesToRead: plan.filesToRead || [],
    filesToModify: plan.filesToModify || [],
    newFiles: plan.newFiles || []
  }))
  lines.push('-->')
  return lines.join('\n')
}

export function parsePlanJson(planMarkdown) {
  const m = planMarkdown?.match(/<!-- AGENTOS_PLAN_JSON\n([\s\S]+?)\n-->/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}
