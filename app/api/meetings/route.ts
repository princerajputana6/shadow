import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Meeting from '@/models/Meeting'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const { searchParams } = new URL(req.url)
  const upcomingOnly = searchParams.get('upcoming') !== '0'

  const filter: Record<string, unknown> = { userId: session.user.id }
  if (upcomingOnly) filter.scheduledAt = { $gte: new Date() }

  const meetings = await Meeting.find(filter).sort({ scheduledAt: 1 }).limit(50).lean()
  return NextResponse.json({ meetings })
}
