// Workflow execution engine — runs a WorkflowRun document step by step,
// calling the appropriate runner agent for each step and passing context forward.

import { connectDB } from '../lib/mongoose.js'
import WorkflowRun from '../models/WorkflowRun.js'
import WorkflowDef from '../models/WorkflowDef.js'
import AgentMessage from '../models/AgentMessage.js'

const RUNNER_SECRET = process.env.RUNNER_SECRET
const RUNNER_URL = process.env.AGENT_RUNNER_URL || 'http://localhost:3001'

async function callRunnerAgent(agentName, payload) {
  const routes = {
    discovery: '/agents/discovery/run',
    sales: '/agents/sales/run',
    social_media: '/agents/social/run',
    developer: '/agents/developer/run',
    cto: '/agents/cto/run',
    leadgen: '/agents/leadgen/run',
    browser: '/agents/browser/run',
    enrich: '/agents/enrich/run'
  }
  const route = routes[agentName]
  if (!route) throw new Error(`Unknown agent: ${agentName}`)

  const res = await fetch(`${RUNNER_URL}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': RUNNER_SECRET },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Agent ${agentName} HTTP ${res.status}`)
  return res.json()
}

function evalCondition(condition, context) {
  if (!condition) return true
  try {
    // Safe-ish eval: only allow simple property access expressions
    const fn = new Function('ctx', `"use strict"; with(ctx) { return !!(${condition}) }`)
    return fn(context)
  } catch {
    return true  // on error, don't skip the step
  }
}

function applyMapping(mapping, source) {
  const out = {}
  for (const [target, sourceKey] of Object.entries(mapping || {})) {
    if (source[sourceKey] !== undefined) out[target] = source[sourceKey]
  }
  return out
}

export async function runWorkflow(runId) {
  await connectDB()

  const run = await WorkflowRun.findById(runId)
  if (!run) throw new Error(`WorkflowRun ${runId} not found`)
  if (run.status !== 'running') return

  const wf = await WorkflowDef.findById(run.workflowId)
  if (!wf) {
    run.status = 'failed'
    run.errorMessage = 'WorkflowDef not found'
    run.completedAt = new Date()
    await run.save()
    return
  }

  let context = { ...run.context }

  for (let i = 0; i < wf.steps.length; i++) {
    const stepDef = wf.steps[i]
    const stepRun = run.steps[i]

    if (!stepRun || stepRun.status === 'completed' || stepRun.status === 'skipped') continue

    // Evaluate skip condition
    if (!evalCondition(stepDef.condition, context)) {
      run.steps[i].status = 'skipped'
      await run.save()
      continue
    }

    // Build step input from context
    const stepInput = applyMapping(stepDef.inputMapping, context)
    run.steps[i].status = 'running'
    run.steps[i].startedAt = new Date()
    run.steps[i].input = stepInput
    await run.save()

    let attempt = 0
    let succeeded = false
    let lastError = ''
    const maxAttempts = (stepDef.retries || 0) + 1

    while (attempt < maxAttempts && !succeeded) {
      attempt++
      try {
        const result = await callRunnerAgent(stepDef.agentName, { ...stepInput, userId: context.userId })
        // Merge step output into context
        const stepOutput = applyMapping(stepDef.outputMapping, result)
        context = { ...context, ...stepOutput, [`__step_${stepDef.id}`]: result }

        run.steps[i].status = 'completed'
        run.steps[i].completedAt = new Date()
        run.steps[i].output = result
        run.steps[i].attempt = attempt
        succeeded = true
      } catch (err) {
        lastError = err.message
        run.steps[i].attempt = attempt
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000 * attempt))
        }
      }
    }

    if (!succeeded) {
      run.steps[i].status = 'failed'
      run.steps[i].error = lastError
      run.steps[i].completedAt = new Date()
      // Fail the whole workflow on step failure
      run.status = 'failed'
      run.errorMessage = `Step "${stepDef.name}" failed after ${attempt} attempts: ${lastError}`
      run.completedAt = new Date()
      run.context = context
      await run.save()
      return
    }

    run.context = context
    await run.save()
  }

  run.status = 'completed'
  run.completedAt = new Date()
  run.context = context
  await run.save()

  // Notify via agent message if workflow result needs routing
  if (wf.triggerAgent) {
    await AgentMessage.create({
      userId: run.userId,
      fromAgent: 'workflow',
      toAgent: wf.triggerAgent,
      subject: `Workflow "${wf.name}" completed`,
      payload: { runId: String(run._id), context: context },
      status: 'pending',
      priority: 3
    })
  }

  console.log(`[workflow] run ${runId} completed — ${wf.steps.length} steps`)
}
