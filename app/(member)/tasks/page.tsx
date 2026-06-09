import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Task from '@/models/Task'
import Repo from '@/models/Repo'
import { getCurrentOrg } from '@/lib/access'
import Link from 'next/link'
import { SyncReposButton } from './_components/SyncReposButton'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = {
  backlog: 'bg-zinc-500/10 text-zinc-300',
  triaging: 'bg-amber-500/10 text-amber-300',
  in_progress: 'bg-sky-500/10 text-sky-300',
  pr_open: 'bg-violet-500/10 text-violet-300',
  blocked: 'bg-red-500/10 text-red-300',
  done: 'bg-emerald-500/10 text-emerald-300',
  cancelled: 'bg-zinc-500/10 text-zinc-500'
}

export default async function TasksPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const current = await getCurrentOrg(session.user.id)
  if (!current) return <div className="text-sm text-muted">No organization.</div>

  await connectDB()
  const [tasks, repos] = await Promise.all([
    Task.find({ organizationId: current.org._id }).sort({ createdAt: -1 }).limit(100).lean(),
    Repo.find({ organizationId: current.org._id }).select('fullName').lean()
  ])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engineering tasks</h1>
          <p className="text-sm text-muted">
            CTO agent triages and assigns to Developer. Developer opens draft PRs. You merge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncReposButton hasRepos={repos.length > 0} />
          <Link href="/tasks/new"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black">
            + New task
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted bg-bg/50">
            <tr>
              <th className="px-5 py-2 font-medium">Task</th>
              <th className="px-5 py-2 font-medium">Status</th>
              <th className="px-5 py-2 font-medium">Agent</th>
              <th className="px-5 py-2 font-medium">Priority</th>
              <th className="px-5 py-2 font-medium">PR</th>
              <th className="px-5 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <tr key={String(t._id)} className="border-t border-border hover:bg-bg/30">
                <td className="px-5 py-3 max-w-md">
                  <Link href={`/tasks/${String(t._id)}`} className="font-medium hover:text-accent">
                    {t.title}
                  </Link>
                  {t.repoUrl && (
                    <div className="text-[11px] text-muted truncate">{t.repoUrl.replace('https://github.com/', '')}</div>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[t.status] || ''}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs capitalize">{t.assignedAgent}</td>
                <td className="px-5 py-3 text-xs capitalize">{t.priority}</td>
                <td className="px-5 py-3 text-xs">
                  {t.prUrl ? (
                    <a href={t.prUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">View PR ↗</a>
                  ) : '—'}
                </td>
                <td className="px-5 py-3 text-xs text-muted">{new Date(t.createdAt).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
            {!tasks.length && (
              <tr><td className="px-5 py-8 text-center text-sm text-muted" colSpan={6}>
                No tasks yet. <Link href="/tasks/new" className="text-accent hover:underline">Create your first one</Link>.
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
