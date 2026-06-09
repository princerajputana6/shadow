import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Repo from '@/models/Repo'
import { getCurrentOrg } from '@/lib/access'
import { NewTaskForm } from './_form'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NewTaskPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const current = await getCurrentOrg(session.user.id)
  if (!current) return <div className="text-sm text-muted">No organization.</div>

  await connectDB()
  const repos = await Repo.find({ organizationId: current.org._id })
    .sort({ lastSyncedAt: -1 }).select('fullName').lean()

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-xs text-muted"><Link href="/tasks" className="hover:text-text">← Tasks</Link></p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">New task</h1>
        <p className="text-sm text-muted">CTO agent will pick it up, plan a fix, and hand it to Developer.</p>
      </header>
      <NewTaskForm repos={repos.map(r => ({ id: String(r._id), fullName: r.fullName }))} />
    </div>
  )
}
