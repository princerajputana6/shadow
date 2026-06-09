import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Business from '@/models/Business'
import Prospect from '@/models/Prospect'
import Link from 'next/link'
import { AddBusinessForm } from './_components/AddBusinessForm'
import { BusinessCard } from './_components/BusinessCard'

export const dynamic = 'force-dynamic'

export default async function BusinessesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  await connectDB()
  const businesses = await Business.find({ userId }).sort({ createdAt: -1 }).lean()

  // Decorate each with a count of staged prospects
  const withCounts = await Promise.all(businesses.map(async (b) => ({
    ...b,
    prospectCount: await Prospect.countDocuments({ userId, businessId: b._id, source: 'discovered' })
  })))

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your businesses</h1>
          <p className="text-sm text-muted">
            Each business has its own targeting profile. Shadow can find leads scoped to any of them — say
            <span className="text-text"> "Hey Shadow, find leads for biztreck"</span>.
          </p>
        </div>
        <Link href="/dashboard" className="text-xs text-muted hover:text-text">← Dashboard</Link>
      </header>

      <AddBusinessForm />

      {!withCounts.length ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          No businesses yet. Paste your URL above — Claude will read your homepage and seed the profile in ~10 seconds.
        </div>
      ) : (
        <div className="space-y-4">
          {/* @ts-expect-error — Mongoose lean output */}
          {withCounts.map((b) => <BusinessCard key={String(b._id)} business={b} />)}
        </div>
      )}
    </main>
  )
}
