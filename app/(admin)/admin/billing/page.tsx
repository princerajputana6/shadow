import { connectDB } from '@/lib/mongoose'
import Organization from '@/models/Organization'
import AgentSubscription, { AGENT_CATALOG } from '@/models/AgentSubscription'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  await connectDB()
  const subs = await AgentSubscription.find({ enabled: true, status: 'active' }).lean()
  const orgIds = Array.from(new Set(subs.map(s => String(s.organizationId))))
  const orgs = await Organization.find({ _id: { $in: orgIds } }).lean()
  const orgMap = new Map(orgs.map(o => [String(o._id), o]))

  const mrr = subs.reduce((s, x) => s + (x.monthlyPriceINR || 0), 0)
  const byOrg = new Map<string, { name: string; mrr: number; agentNames: string[] }>()
  for (const s of subs) {
    const k = String(s.organizationId)
    const o = orgMap.get(k)
    if (!o) continue
    const agentName = AGENT_CATALOG.find(a => a.key === s.agentKey)?.name || s.agentKey
    const row = byOrg.get(k) || { name: o.name, mrr: 0, agentNames: [] }
    row.mrr += s.monthlyPriceINR || 0
    if ((s.monthlyPriceINR || 0) > 0) row.agentNames.push(agentName)
    byOrg.set(k, row)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted">Monthly revenue from active agent subscriptions. Razorpay integration ships next session.</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label="MRR" value={`₹${mrr.toLocaleString('en-IN')}`} sub={`${byOrg.size} paying orgs`} />
        <Kpi label="ARR (projected)" value={`₹${(mrr * 12).toLocaleString('en-IN')}`} sub="MRR × 12" />
        <Kpi label="Avg revenue per org" value={byOrg.size ? `₹${Math.round(mrr / byOrg.size).toLocaleString('en-IN')}` : '—'} />
      </section>

      <section className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Per-org revenue</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted bg-bg/50">
            <tr>
              <th className="px-5 py-2 font-medium">Company</th>
              <th className="px-5 py-2 font-medium">Active agents</th>
              <th className="px-5 py-2 font-medium text-right">MRR</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byOrg.entries()).sort((a, b) => b[1].mrr - a[1].mrr).map(([id, row]) => (
              <tr key={id} className="border-t border-border">
                <td className="px-5 py-3">
                  <Link href={`/admin/companies/${id}`} className="hover:text-accent">{row.name}</Link>
                </td>
                <td className="px-5 py-3 text-xs text-muted">{row.agentNames.join(', ') || '—'}</td>
                <td className="px-5 py-3 text-right tabular-nums">₹{row.mrr.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {!byOrg.size && (
              <tr><td className="px-5 py-8 text-center text-sm text-muted" colSpan={3}>
                No paying orgs yet. Add a company in Companies and enable some agents.
              </td></tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-5 text-sm text-muted">
        <p className="text-text font-medium mb-1">Razorpay integration — next session</p>
        <p>You already have <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in env. The wiring:
        create a Razorpay Plan per agent → on "Enable" create a Subscription → webhook updates <code>status</code> when payment succeeds/fails →
        suspend access automatically on <code>past_due</code>.</p>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  )
}
