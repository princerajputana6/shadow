import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Briefing from '@/models/Briefing'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const briefing = await Briefing.findOne({ userId: session.user.id }).sort({ createdAt: -1 })
  return NextResponse.json({ briefing })
}
