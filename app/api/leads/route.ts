import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Lead from '@/models/Lead'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const limit = Math.min(100, Number(searchParams.get('limit') || 20))
  const status = searchParams.get('status')

  const filter: Record<string, unknown> = { userId: session.user.id }
  if (status) filter.status = status

  const [leads, total] = await Promise.all([
    Lead.find(filter).sort({ urgency: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Lead.countDocuments(filter)
  ])
  return NextResponse.json({ leads, page, limit, total })
}
