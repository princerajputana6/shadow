// Agent-to-Agent message bus.
// Polls AgentMessage for pending messages addressed to a given agent
// and dispatches them to the appropriate runner endpoint.

import { connectDB } from './mongoose.js'
import AgentMessage from '../models/AgentMessage.js'

const RUNNER_URL = process.env.AGENT_RUNNER_URL || 'http://localhost:3001'
const RUNNER_SECRET = process.env.RUNNER_SECRET

const AGENT_ROUTES = {
  developer: '/agents/developer/run',
  cto: '/agents/cto/run',
  social_media: '/agents/social/run',
  sales_finder: '/agents/sales/run',
  discovery: '/agents/discovery/run',
  leadgen: '/agents/leadgen/run',
  browser: '/agents/browser/run',
  workflow: '/agents/workflow/run'
}

export async function dispatchPendingMessages(agentName) {
  await connectDB()

  const filter = agentName
    ? { toAgent: agentName, status: 'pending' }
    : { status: 'pending' }

  const messages = await AgentMessage.find(filter)
    .sort({ priority: -1, createdAt: 1 })
    .limit(20)
    .lean()

  if (!messages.length) return { dispatched: 0 }

  let dispatched = 0
  for (const msg of messages) {
    const route = AGENT_ROUTES[msg.toAgent]
    if (!route) {
      await AgentMessage.updateOne(
        { _id: msg._id },
        { status: 'failed', errorMessage: `No route for agent: ${msg.toAgent}`, processedAt: new Date() }
      )
      continue
    }

    try {
      const res = await fetch(`${RUNNER_URL}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-runner-secret': RUNNER_SECRET },
        body: JSON.stringify({ ...msg.payload, _messageId: String(msg._id) })
      })
      if (res.ok) {
        await AgentMessage.updateOne(
          { _id: msg._id },
          { status: 'delivered', processedAt: new Date() }
        )
        dispatched++
      } else {
        await AgentMessage.updateOne(
          { _id: msg._id },
          { status: 'failed', errorMessage: `HTTP ${res.status}`, processedAt: new Date() }
        )
      }
    } catch (err) {
      await AgentMessage.updateOne(
        { _id: msg._id },
        { status: 'failed', errorMessage: err.message, processedAt: new Date() }
      )
    }
  }

  return { dispatched }
}

// Convenience: post a message from one agent to another
export async function sendAgentMessage(userId, { fromAgent, toAgent, subject, payload, priority = 3, runId, taskId }) {
  await connectDB()
  return AgentMessage.create({
    userId,
    fromAgent,
    toAgent,
    subject,
    payload: payload || {},
    priority,
    runId: runId || null,
    taskId: taskId || null,
    status: 'pending'
  })
}
