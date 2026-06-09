import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import Task from '@/models/Task'
import { getCurrentOrg } from '@/lib/access'
import Link from 'next/link'
import { TaskActions } from './_components/TaskActions'

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

export default async function TaskPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const current = await getCurrentOrg(session.user.id)
  if (!current) redirect('/dashboard')

  await connectDB()
  const task = await Task.findOne({ _id: params.id, organizationId: current.org._id }).lean()
  if (!task) notFound()

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="text-xs text-muted"><Link href="/tasks" className="hover:text-text">← Tasks</Link></p>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${STATUS_COLOR[task.status]}`}>{task.status.replace('_', ' ')}</span>
              <span className="text-muted">·</span>
              <span className="text-muted">Assigned: <span className="text-text capitalize">{task.assignedAgent}</span></span>
              <span className="text-muted">·</span>
              <span className="text-muted">Priority: <span className="text-text capitalize">{task.priority}</span></span>
              {task.repoUrl && (
                <>
                  <span className="text-muted">·</span>
                  <a href={task.repoUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {task.repoUrl.replace('https://github.com/', '')} ↗
                  </a>
                </>
              )}
            </div>
          </div>
          <TaskActions taskId={String(task._id)} status={task.status} hasRepo={!!task.repoUrl} hasPlan={!!task.ctoPlan} />
        </div>
      </header>

      {task.description && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium mb-2">Description</h2>
          <p className="text-sm whitespace-pre-wrap">{task.description}</p>
        </section>
      )}

      {task.ctoPlan && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium mb-2">CTO plan</h2>
          <pre className="text-sm whitespace-pre-wrap font-sans">{task.ctoPlan}</pre>
        </section>
      )}

      {task.developerNotes && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-medium mb-2">Developer notes</h2>
          <pre className="text-sm whitespace-pre-wrap font-sans">{task.developerNotes}</pre>
          {task.prUrl && (
            <a href={task.prUrl} target="_blank" rel="noreferrer"
               className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black">
              Review draft PR ↗
            </a>
          )}
        </section>
      )}

      {task.errorMessage && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
          <h2 className="text-sm font-medium mb-2 text-red-300">Last error</h2>
          <pre className="text-xs whitespace-pre-wrap text-red-200">{task.errorMessage}</pre>
        </section>
      )}
    </div>
  )
}
