import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import { consolidateMemories, autoSummarize, applyShortTermExpiry } from '@/lib/memoryOps'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ops = ['consolidate', 'summarize', 'expire'] } = await req.json().catch(() => ({}))
  await connectDB()

  const userId = session.user.id
  const results: Record<string, number> = {}

  if (ops.includes('consolidate')) {
    results.consolidated = await consolidateMemories(userId)
  }
  if (ops.includes('summarize')) {
    results.summarized = await autoSummarize(userId)
  }
  if (ops.includes('expire')) {
    results.expiredTagged = await applyShortTermExpiry(userId)
  }

  return NextResponse.json(results)
}
