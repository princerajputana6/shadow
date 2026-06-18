// Trigger a workflow run — delegates execution to the runner.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import WorkflowDef from '@/models/WorkflowDef'
import WorkflowRun from '@/models/WorkflowRun'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workflowId, context = {} } = await req.json().catch(() => ({}))
  if (!workflowId) return NextResponse.json({ error: 'workflowId required' }, { status: 400 })

  await connectDB()
  const wf = await WorkflowDef.findOne({ _id: workflowId, userId: session.user.id, active: true })
  if (!wf) return NextResponse.json({ error: 'Workflow not found or inactive' }, { status: 404 })

  const run = await WorkflowRun.create({
    userId: session.user.id,
    workflowId: wf._id,
    status: 'running',
    context: { userId: session.user.id, ...context },
    steps: wf.steps.map((s) => ({ stepId: s.id, agentName: s.agentName, status: 'pending', input: {}, output: {}, attempt: 0 })),
    triggeredBy: 'manual'
  })

  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (runnerUrl && runnerSecret) {
    fetch(`${runnerUrl}/agents/workflow/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
      body: JSON.stringify({ runId: String(run._id), userId: session.user.id })
    }).catch((e) => console.error('[workflow] runner notify failed:', e))
  }

  return NextResponse.json({ runId: String(run._id), status: 'running' }, { status: 202 })
}
