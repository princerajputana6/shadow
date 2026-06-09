import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import SocialPost from '@/models/SocialPost'
import Link from 'next/link'
import { PostCard } from './_components/PostCard'
import { TriggerSocialButton } from './_components/TriggerSocialButton'

export const dynamic = 'force-dynamic'

export default async function SocialPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const filter: Record<string, unknown> = { userId: session.user.id }
  if (searchParams.status) filter.status = searchParams.status
  else filter.status = { $in: ['draft', 'approved'] }

  await connectDB()
  const posts = await SocialPost.find(filter).sort({ createdAt: -1 }).limit(100).lean()

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Social posts</h1>
          <p className="text-sm text-muted">Drafts written by the Social Media agent. Review, edit, approve. Copy + paste to post until X/LinkedIn API keys are wired up.</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <Link href="/dashboard" className="hover:text-text">← Dashboard</Link>
          <TriggerSocialButton />
        </div>
      </header>

      <nav className="flex gap-2 text-xs">
        {[
          { k: '', label: 'Active' },
          { k: 'draft', label: 'Drafts' },
          { k: 'approved', label: 'Approved' },
          { k: 'posted', label: 'Posted' },
          { k: 'rejected', label: 'Rejected' }
        ].map(t => (
          <Link key={t.k} href={t.k ? `/social?status=${t.k}` : '/social'}
                className={`rounded-full px-3 py-1 border border-border ${
                  (searchParams.status || '') === t.k ? 'bg-accent text-black' : 'text-muted hover:text-text'
                }`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {!posts.length ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          Nothing here yet. Click <span className="text-text">Draft new posts</span> to generate 5 drafts (1 per platform/tone combo) based on your business profile.
        </div>
      ) : (
        <div className="space-y-3">
          {/* @ts-expect-error — Mongoose lean output */}
          {posts.map(p => <PostCard key={String(p._id)} post={p} />)}
        </div>
      )}
    </main>
  )
}
