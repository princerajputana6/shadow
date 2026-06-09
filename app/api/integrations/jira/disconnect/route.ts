import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const user = await User.findById(session.user.id)
  if (user) { user.jiraTokens = undefined; await user.save() }
  return NextResponse.redirect(new URL('/integrations', req.url))
}
