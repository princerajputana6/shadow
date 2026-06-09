import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Meeting from '@/models/Meeting'
import { MeetingsCard } from '@/components/MeetingsCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MeetingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const meetings = await Meeting.find({ userId: session.user.id })
    .sort({ scheduledAt: 1 })
    .limit(50)
    .lean()

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <Link href="/dashboard" className="text-xs text-muted hover:text-text">← Dashboard</Link>
      </header>
      {/* @ts-expect-error — Mongoose lean output */}
      <MeetingsCard meetings={meetings} />
    </main>
  )
}
