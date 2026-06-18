import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import Task from '../models/Task.js'
import Repo from '../models/Repo.js'
import User from '../models/User.js'
import AgentRun from '../models/AgentRun.js'
import {
  getFileContent, createBranch, upsertFile, openDraftPR
} from '../tools/githubTool.js'
import { parsePlanJson } from './ctoAgent.js'

const MODEL = process.env.CLAUDE_CODE_MODEL || process.env.CLAUDE_MODEL || 'claude-haiku-4-5'

const MAX_FILE_BYTES = 60_000  // per-file read cap
const MAX_TOTAL_BYTES = 240_000  // overall context budget

// Developer agent — opens a DRAFT PR. Never auto-merges.
//   1. Load task + CTO plan (must have ctoPlan with structured JSON)
//   2. Fetch contents of filesToRead and filesToModify
//   3. Ask Claude to return a list of {path, content} for each modified/new file
//   4. Create feature branch from default branch
//   5. Commit each file change to that branch (one commit per file for clean history)
//   6. Open draft PR; save URL on task

export async function runDeveloperAgent(taskId) {
  await connectDB()
  const task = await Task.findById(taskId)
  if (!task) throw new Error('Task not found')
  if (!task.ctoPlan) throw new Error('Task has no CTO plan — run CTO triage first')
  if (!task.repoUrl) throw new Error('Task has no repo')

  const match = task.repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/)
  if (!match) throw new Error('Could not parse repo URL')
  const [, owner, repoName] = match
  const repo = await Repo.findOne({ organizationId: task.organizationId, fullName: `${owner}/${repoName}` })
  if (!repo) throw new Error('Repo not connected — sync at /tasks')
  const user = await User.findById(repo.connectedByUserId)
  const token = user?.githubTokens?.accessToken
  if (!token) throw new Error('GitHub token missing')

  const planJson = parsePlanJson(task.ctoPlan) || { filesToRead: [], filesToModify: [], newFiles: [] }
  const baseBranch = task.branch || repo.defaultBranch || 'main'

  const run = await AgentRun.create({
    userId: task.createdByUserId, organizationId: task.organizationId,
    agentName: 'developer', status: 'running',
    stats: { taskId: String(task._id) }
  })

  try {
    // Fetch all files (read + modify) — modify files become "current contents"
    const allPaths = Array.from(new Set([...(planJson.filesToRead || []), ...(planJson.filesToModify || [])]))
    const fetched = []
    let total = 0
    for (const p of allPaths) {
      if (total > MAX_TOTAL_BYTES) break
      try {
        const f = await getFileContent(token, owner, repoName, p, baseBranch)
        if (f.content.length > MAX_FILE_BYTES) {
          fetched.push({ path: p, sha: f.sha, content: f.content.slice(0, MAX_FILE_BYTES) + '\n// [truncated]', truncated: true })
        } else {
          fetched.push({ path: p, sha: f.sha, content: f.content, truncated: false })
        }
        total += fetched[fetched.length - 1].content.length
      } catch (e) {
        console.warn(`[developer] could not fetch ${p}:`, e.message)
      }
    }

    const prompt = buildDevPrompt(task, planJson, fetched)
    const aiRes = await claude.messages.create({
      model: MODEL, max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = aiRes.content[0]?.type === 'text' ? aiRes.content[0].text : ''
    const json = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    let result
    try { result = JSON.parse(json) } catch (e) {
      throw new Error(`Developer output was not valid JSON. First 300 chars: ${text.slice(0, 300)}`)
    }
    if (!Array.isArray(result.changes) || !result.changes.length) {
      throw new Error('Developer returned no changes')
    }

    // Create feature branch
    const branchName = `shadow/task-${String(task._id).slice(-8)}-${slugify(task.title).slice(0, 40)}`
    try {
      await createBranch(token, owner, repoName, baseBranch, branchName)
    } catch (e) {
      // If branch already exists, that's OK — we'll commit on top
      if (!/already exists|Reference already exists/i.test(e.message)) throw e
    }

    // Apply changes one file at a time (one commit each for readability)
    const fileShas = new Map(fetched.map(f => [f.path, f.sha]))
    const applied = []
    for (const c of result.changes) {
      if (!c.path || typeof c.content !== 'string') continue
      const existingSha = fileShas.get(c.path)
      await upsertFile(token, owner, repoName, c.path, c.content,
        c.commitMessage || `shadow: update ${c.path}`,
        branchName, existingSha)
      applied.push(c.path)
    }

    // Open draft PR
    const prBody = renderPrBody(task, result, applied)
    const pr = await openDraftPR(token, owner, repoName, {
      head: branchName, base: baseBranch,
      title: `shadow: ${task.title.slice(0, 100)}`,
      body: prBody
    })

    task.prUrl = pr.html_url
    task.status = 'pr_open'
    task.developerNotes = result.summary || ''
    task.completedAt = new Date()
    await task.save()

    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'completed', completedAt: new Date(),
      stats: { taskId: String(task._id), filesChanged: applied.length, prUrl: pr.html_url }
    })
    return { prUrl: pr.html_url, files: applied }
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

function buildDevPrompt(task, plan, fetched) {
  const fileBlock = fetched.map(f =>
    `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n${f.truncated ? '_(file was truncated)_\n' : ''}`
  ).join('\n')

  return `You are a senior developer implementing a fix. The CTO has already triaged and planned.

TASK
Title: ${task.title}
Description:
${task.description || '(no description)'}

CTO PLAN
${task.ctoPlan}

CURRENT FILES (read-only context — modify those that need changing, leave the rest alone):

${fileBlock}

RULES:
- Only modify files where a change is genuinely needed
- Preserve existing code style and patterns
- No giant rewrites — minimum diff that solves the task
- For new files: include the full content
- For modified files: return the COMPLETE new content (not a patch)
- Do not change unrelated files
- Do not include explanations inside the file content
- If you cannot determine a safe change for a file, omit it

Return ONLY valid JSON (no markdown):
{
  "summary": "2-4 sentence summary of what you changed and why",
  "changes": [
    {
      "path": "path/from/repo/root.ext",
      "content": "the full new file content",
      "commitMessage": "short conventional-commit style message"
    }
  ],
  "testingNotes": "optional notes on how to test the change",
  "concerns": ["optional list of things the reviewer should double-check"]
}`
}

function renderPrBody(task, result, applied) {
  return `## ${task.title}

${result.summary || ''}

### Files changed
${applied.map(p => `- \`${p}\``).join('\n')}

${result.testingNotes ? `### Testing\n${result.testingNotes}\n` : ''}
${result.concerns?.length ? `### Reviewer should check\n${result.concerns.map(c => `- ${c}`).join('\n')}\n` : ''}

---
*This PR was drafted by Shadow's Dev agent. Always review before merging.*
Source task: \`${String(task._id)}\``
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
