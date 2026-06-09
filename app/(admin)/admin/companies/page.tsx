import { connectDB } from '@/lib/mongoose'
import Organization from '@/models/Organization'
import AgentSubscription from '@/models/AgentSubscription'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  await connectDB()
  const orgs = await Organization.find({}).sort({ createdAt: -1 }).lean()

  const allSubs = await AgentSubscription.find({ organizationId: { $in: orgs.map(o => o._id) } }).lean()
  const subsByOrg = new Map<string, { enabled: number; mrr: number }>()
  for (const o of orgs) subsByOrg.set(String(o._id), { enabled: 0, mrr: 0 })
  for (const s of allSubs) {
    if (s.enabled && s.status === 'active') {
      const k = String(s.organizationId)
      const row = subsByOrg.get(k)!
      row.enabled++
      row.mrr += s.monthlyPriceINR || 0
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted">All organizations using the platform.</p>
        </div>
        <Link href="/admin/companies/new"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-black">
          + Add company
        </Link>
      </header>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted bg-bg/50">
            <tr>
              <th className="px-5 py-2 font-medium">Company</th>
              <th className="px-5 py-2 font-medium">Status</th>
              <th className="px-5 py-2 font-medium">Agents</th>
              <th className="px-5 py-2 font-medium">MRR</th>
              <th className="px-5 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(o => {
              const s = subsByOrg.get(String(o._id))!
              return (
                <tr key={String(o._id)} className="border-t border-border hover:bg-bg/30">
                  <td className="px-5 py-3">
                    <Link href={`/admin/companies/${String(o._id)}`} className="font-medium hover:text-accent">
                      {o.name}
                    </Link>
                    <div className="text-[11px] text-muted">{o.contactEmail}</div>
                  </td>
                  <td className="px-5 py-3"><StatusPill status={o.status} /></td>
                  <td className="px-5 py-3 tabular-nums">{s.enabled}/5</td>
                  <td className="px-5 py-3 tabular-nums">
                    {s.mrr > 0 ? `₹${s.mrr.toLocaleString('en-IN')}` : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              )
            })}
            {!orgs.length && (
              <tr><td className="px-5 py-8 text-center text-sm text-muted" colSpan={5}>
                No companies yet. Click <span className="text-text">+ Add company</span> to onboard one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-300',
    trial: 'bg-sky-500/10 text-sky-300',
    suspended: 'bg-amber-500/10 text-amber-300',
    cancelled: 'bg-zinc-500/10 text-zinc-400'
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] || ''}`}>{status}</span>
}
