import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import AgentRun from '@/models/AgentRun'
import Task from '@/models/Task'
import { getCurrentOrg } from '@/lib/access'
import {
  AGENT_ROSTER,
  AGENT_DETAILS,
  type AgentRoleKey
} from '@/lib/agentRoster'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

const ACCENT: Record<string, { grad: string; ring: string; text: string; glow: string }> = {
  violet:  { grad: 'from-violet-500/30 to-violet-700/30',   ring: 'ring-violet-400/40',  text: 'text-violet-200',  glow: 'shadow-violet-500/30' },
  sky:     { grad: 'from-sky-500/30 to-sky-700/30',         ring: 'ring-sky-400/40',     text: 'text-sky-200',     glow: 'shadow-sky-500/30' },
  orange:  { grad: 'from-orange-500/30 to-orange-700/30',   ring: 'ring-orange-400/40',  text: 'text-orange-200',  glow: 'shadow-orange-500/30' },
  amber:   { grad: 'from-amber-500/30 to-amber-700/30',     ring: 'ring-amber-400/40',   text: 'text-amber-200',   glow: 'shadow-amber-500/30' },
  emerald: { grad: 'from-emerald-500/30 to-emerald-700/30', ring: 'ring-emerald-400/40', text: 'text-emerald-200', glow: 'shadow-emerald-500/30' },
  fuchsia: { grad: 'from-fuchsia-500/30 to-fuchsia-700/30', ring: 'ring-fuchsia-400/40', text: 'text-fuchsia-200', glow: 'shadow-fuchsia-500/30' }
}

export default async function AgentDetailPage({ params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const agent = AGENT_ROSTER.find(a => a.key === params.slug)
  if (!agent) notFound()
  const detail = AGENT_DETAILS[agent.key as AgentRoleKey]
  const acc = ACCENT[agent.accent]

  const current = await getCurrentOrg(session.user.id)
  if (!current) redirect('/dashboard')

  await connectDB()
  const [recentRuns, ownedTasks] = await Promise.all([
    agent.backendAgentName
      ? AgentRun.find({ userId: session.user.id, agentName: agent.backendAgentName })
          .sort({ startedAt: -1 }).limit(8).lean()
      : Promise.resolve([]),
    Task.find({ organizationId: current.org._id, assignedAgent: agent.key })
        .sort({ createdAt: -1 }).limit(5).lean()
  ])

  const collaborators = detail.collaboratesWith
    .map(k => AGENT_ROSTER.find(a => a.key === k))
    .filter(Boolean) as typeof AGENT_ROSTER

  return (
    <div className="space-y-7">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-5">
          <div className={`relative h-20 w-20 rounded-2xl bg-gradient-to-br ${acc.grad} ring-1 ${acc.ring} flex items-center justify-center text-3xl ${acc.text} shadow-xl ${acc.glow}`}>
            <span className="relative">{agent.icon}</span>
            <span className={`absolute inset-0 rounded-2xl ring-1 ${acc.ring} animate-pulse opacity-60`} />
          </div>
          <div>
            <p className="text-xs text-muted"><Link href="/agents" className="hover:text-text">← Agent network</Link></p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{agent.name}</h1>
            <p className={`text-[10px] uppercase tracking-[0.22em] ${acc.text}`}>{agent.roleTitle}</p>
            <p className="mt-3 max-w-xl text-sm text-muted">{agent.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link href={`/tasks/new?agent=${agent.key}`}
                className={`rounded-lg bg-gradient-to-br ${acc.grad} ring-1 ${acc.ring} px-4 py-2 text-sm font-medium hover:scale-[1.02] transition`}>
            + Assign task to {agent.name}
          </Link>
          <div className="text-[10px] uppercase tracking-wider text-muted">
            Model · <span className="font-mono">{agent.model}</span>
          </div>
        </div>
      </header>

      {/* Responsibilities */}
      <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-6">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-4">Responsibilities</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
          {detail.responsibilities.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${acc.text}`} />
              <span className="text-text/85">{r}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Inputs ⇢ Outputs */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-6">
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">Reads from</h3>
          <ul className="space-y-2 text-sm">
            {detail.inputs.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="text-cyan-300">←</span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-6">
          <h3 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">Produces</h3>
          <ul className="space-y-2 text-sm">
            {detail.outputs.map((o, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className={acc.text}>→</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Collaborators */}
      <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-6">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted mb-4">Hands off to / receives from</h2>
        <div className="flex flex-wrap gap-3">
          {collaborators.map(c => {
            const cAcc = ACCENT[c.accent]
            return (
              <Link key={c.key} href={`/agents/${c.key}`}
                    className={`group flex items-center gap-3 rounded-xl border border-cyan-500/10 bg-bg/40 px-3.5 py-2.5 hover:bg-bg/60 ring-1 ${cAcc.ring}`}>
                <span className={`h-7 w-7 rounded-lg bg-gradient-to-br ${cAcc.grad} flex items-center justify-center text-sm ${cAcc.text}`}>{c.icon}</span>
                <div>
                  <div className="text-sm font-medium uppercase tracking-wider">{c.name}</div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-muted/70">{c.roleTitle}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Recent runs */}
      {agent.backendAgentName && (
        <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-cyan-500/10">
            <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">Recent runs</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted/60">{recentRuns.length} shown</span>
          </div>
          {recentRuns.length === 0 ? (
            <p className="p-6 text-sm text-muted text-center">No runs yet.</p>
          ) : (
            <ul className="divide-y divide-cyan-500/5">
              {recentRuns.map((r) => (
                <li key={String(r._id)} className="px-6 py-3 flex items-center gap-4 text-sm">
                  <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    r.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300' :
                    r.status === 'failed' ? 'bg-red-500/10 text-red-300' :
                    'bg-amber-500/10 text-amber-300'
                  }`}>{r.status}</span>
                  <span className="text-muted shrink-0 w-32">
                    {formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}
                  </span>
                  <span className="text-text/80 truncate flex-1">
                    {typeof r.stats?.briefingSummary === 'string' ? r.stats.briefingSummary.slice(0, 100)
                     : typeof r.stats?.business === 'string' ? `business: ${r.stats.business}`
                     : r.errorMessage?.slice(0, 100) || '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Owned tasks */}
      <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-cyan-500/10">
          <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">Tasks assigned to {agent.name}</h2>
          <Link href="/tasks" className="text-xs text-accent hover:underline">All tasks →</Link>
        </div>
        {ownedTasks.length === 0 ? (
          <p className="p-6 text-sm text-muted text-center">
            No tasks assigned. <Link href={`/tasks/new?agent=${agent.key}`} className="text-accent hover:underline">Create one</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-cyan-500/5">
            {ownedTasks.map((t) => (
              <li key={String(t._id)} className="px-6 py-3 flex items-center justify-between gap-4">
                <Link href={`/tasks/${String(t._id)}`} className="text-sm hover:text-accent truncate flex-1">
                  {t.title}
                </Link>
                <span className="text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border border-border text-muted shrink-0">
                  {t.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
