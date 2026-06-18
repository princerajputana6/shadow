import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Prospect from '@/models/Prospect'
import User from '@/models/User'
import Link from 'next/link'
import { DiscoveryRow } from './_components/DiscoveryRow'
import { TriggerDiscoveryButton } from './_components/TriggerDiscoveryButton'
import { TriggerLeadgenButton } from './_components/TriggerLeadgenButton'
import { EnrichButton } from './_components/EnrichButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DiscoveryPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const [candidates, user] = await Promise.all([
    Prospect.find({
      userId: session.user.id,
      source: 'discovered',
      status: 'not_contacted',
      'consent.granted': false
    }).sort({ createdAt: -1 }).limit(100).lean(),
    User.findById(session.user.id).select('crmSheetId').lean()
  ])
  const crmUrl = user?.crmSheetId
    ? `https://docs.google.com/spreadsheets/d/${user.crmSheetId}/edit`
    : null

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Discovery queue</h1>
          <p className="text-sm text-muted">
            Candidate companies surfaced by Tavily web search. Approve to move into outreach; reject to drop. Nothing here gets contacted automatically — explicit approval required.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <Link href="/dashboard" className="hover:text-text">← Dashboard</Link>
          {crmUrl && (
            <a href={crmUrl} target="_blank" rel="noopener noreferrer" className="hover:text-text underline">
              Open CRM sheet ↗
            </a>
          )}
          <EnrichButton />
          <TriggerLeadgenButton />
          <TriggerDiscoveryButton />
        </div>
      </header>

      {!candidates.length ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          No candidates in the queue yet. Click <span className="text-text">"Run discovery now"</span> to seed it,
          or wait — the discovery agent runs every 6 hours.
        </div>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c) => (
            // @ts-expect-error — Mongoose lean output
            <DiscoveryRow key={String(c._id)} prospect={c} />
          ))}
        </ul>
      )}
    </main>
  )
}
