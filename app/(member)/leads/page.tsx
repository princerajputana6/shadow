import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Lead from '@/models/Lead'
import { LeadTable } from '@/components/LeadTable'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const leads = await Lead.find({ userId: session.user.id })
    .sort({ urgency: -1, createdAt: -1 })
    .limit(200)
    .lean()

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <Link href="/dashboard" className="text-xs text-muted hover:text-text">← Dashboard</Link>
      </header>
      {/* @ts-expect-error — Mongoose lean output */}
      <LeadTable leads={leads} />
    </main>
  )
}
