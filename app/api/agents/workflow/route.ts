// Workflow CRUD — create/read/update/delete workflow definitions.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import WorkflowDef from '@/models/WorkflowDef'
import WorkflowRun from '@/models/WorkflowRun'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  await connectDB()
  if (id) {
    const wf = await WorkflowDef.findOne({ _id: id, userId: session.user.id }).lean()
    if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const runs = await WorkflowRun.find({ workflowId: id })
      .sort({ startedAt: -1 })
      .limit(10)
      .lean()
    return NextResponse.json({ workflow: wf, runs })
  }
  const workflows = await WorkflowDef.find({ userId: session.user.id }).sort({ updatedAt: -1 }).lean()
  return NextResponse.json({ workflows })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { name, description, trigger, cronExpression, triggerAgent, steps, tags } = body
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  await connectDB()
  const wf = await WorkflowDef.create({
    userId: session.user.id,
    name: String(name).slice(0, 200),
    description: String(description || '').slice(0, 1000),
    trigger: trigger || 'manual',
    cronExpression: cronExpression || null,
    triggerAgent: triggerAgent || null,
    steps: Array.isArray(steps) ? steps : [],
    tags: Array.isArray(tags) ? tags : []
  })
  return NextResponse.json({ workflow: wf }, { status: 201 })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  await connectDB()
  const wf = await WorkflowDef.findOneAndUpdate(
    { _id: id, userId: session.user.id },
    { $set: body },
    { new: true }
  )
  if (!wf) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ workflow: wf })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await connectDB()
  await WorkflowDef.deleteOne({ _id: id, userId: session.user.id })
  return NextResponse.json({ ok: true })
}
