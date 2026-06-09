import Link from 'next/link'
import { getAdminSnapshot } from '@/lib/adminStats'
import { formatDistanceToNow } from 'date-fns'

export const dynamic = 'force-dynamic'

function inr(n: number) { return `₹${n.toLocaleString('en-IN')}` }
function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export default async function AdminOverview() {
  const snap = await getAdminSnapshot()
  const t = snap.totals

  return (
    <div className="space-y-8 relative">
      {/* Heading with rotating HUD ring on the side */}
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-5">
          <RotatingHudRing />
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/80 mb-1">Platform Admin · Operator Console</p>
            <h1 className="text-3xl font-semibold tracking-tight"
                style={{ textShadow: '0 0 24px rgba(251,146,60,0.18)' }}>
              Shadow Operator Console
            </h1>
            <p className="text-sm text-muted mt-1">Everything happening across every customer you sell to.</p>
          </div>
        </div>
        <Link href="/admin/companies/new"
              className="rounded-md bg-gradient-to-br from-amber-400 to-orange-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-amber-500/30
                         hover:shadow-amber-500/50 transition">
          + Onboard customer
        </Link>
      </header>

      {/* KPI row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="MRR" value={inr(t.mrrINR)} sub={`${t.payingCustomers} paying`} accent="emerald" />
        <Kpi label="ARR (proj)" value={inr(t.arrINR)} sub="MRR × 12" accent="cyan" />
        <Kpi label="Customers" value={t.customers.toString()} sub={`${t.activeCustomers} active · ${t.trialCustomers} trial`} accent="violet" />
        <Kpi label="Users" value={t.users.toString()} sub="across all orgs" accent="amber" />
        <Kpi label="Runs (7d)" value={compact(t.runs7d)} sub={`${compact(t.runs24h)} in last 24h`} accent="sky" />
        <Kpi label="Tokens (est)" value={compact(t.tokensTotal)} sub={`${t.failures7d} failures 7d`} accent={t.failures7d > 0 ? 'red' : 'emerald'} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Most-used agents */}
        <section className="lg:col-span-2 rounded-2xl border border-amber-500/15 bg-surface/60 backdrop-blur p-5 relative overflow-hidden">
          <CornerTicks />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70">Agent Adoption · 7 days</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted/60">runs / failures</span>
          </div>
          <ul className="space-y-3 text-sm">
            {snap.agentUsage.map(a => {
              const adoption = snap.agentAdoption.find(x => x.key === a.key)
              const maxRuns = Math.max(1, ...snap.agentUsage.map(x => x.runs))
              const pct = (a.runs / maxRuns) * 100
              const failRate = a.runs > 0 ? Math.round((a.failures / a.runs) * 100) : 0
              return (
                <li key={a.key} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="uppercase tracking-wider text-text">{a.name}</span>
                      <span className="text-muted">· {adoption?.activeSubs || 0} subs · {inr(adoption?.mrrINR || 0)}/mo</span>
                    </div>
                    <div className="font-mono tabular-nums text-muted">
                      <span className="text-text">{a.runs}</span> runs
                      {a.failures > 0 && <span className="text-red-300"> · {a.failures} fail ({failRate}%)</span>}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg/60 overflow-hidden flex">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(251,146,60,0.5)]"
                         style={{ width: `${Math.max(2, pct - (failRate / 100) * pct)}%` }} />
                    {a.failures > 0 && <div className="h-full bg-red-500/70" style={{ width: `${(failRate / 100) * pct}%` }} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Recent failures */}
        <section className="rounded-2xl border border-red-500/15 bg-surface/60 backdrop-blur p-5 relative overflow-hidden">
          <CornerTicks color="red" />
          <h2 className="text-[10px] uppercase tracking-[0.22em] text-red-300/70 mb-3">Recent Failures · 7 days</h2>
          {snap.recentFailures.length === 0 ? (
            <p className="text-xs text-emerald-300">No failures in the last week ✓</p>
          ) : (
            <ul className="space-y-2 text-xs max-h-80 overflow-y-auto">
              {snap.recentFailures.map((f, i) => (
                <li key={i} className="border-b border-red-500/5 pb-2 last:border-0">
                  <p className="text-text font-medium">{f.orgName} · {f.agentName.replace('_', ' ')}</p>
                  <p className="text-red-300/80 truncate">{f.errorMessage?.slice(0, 90) || '(no message)'}</p>
                  <p className="text-[10px] text-muted/60 mt-0.5">{formatDistanceToNow(new Date(f.startedAt), { addSuffix: true })}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Customer roster with usage */}
      <section className="rounded-2xl border border-amber-500/15 bg-surface/60 backdrop-blur overflow-hidden relative">
        <CornerTicks />
        <div className="flex items-center justify-between px-5 py-3 border-b border-amber-500/10">
          <h2 className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70">All Customers</h2>
          <Link href="/admin/companies" className="text-xs text-amber-300 hover:underline">Manage all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted bg-bg/40">
            <tr>
              <th className="px-5 py-2 font-medium">Customer</th>
              <th className="px-5 py-2 font-medium">Status</th>
              <th className="px-5 py-2 font-medium text-right">MRR</th>
              <th className="px-5 py-2 font-medium text-right">Agents</th>
              <th className="px-5 py-2 font-medium text-right">Runs 7d</th>
              <th className="px-5 py-2 font-medium text-right">Tokens</th>
              <th className="px-5 py-2 font-medium text-right">Failures</th>
              <th className="px-5 py-2 font-medium text-right">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {snap.customers.map(c => (
              <tr key={c.orgId} className="border-t border-amber-500/5 hover:bg-bg/30">
                <td className="px-5 py-3">
                  <Link href={`/admin/companies/${c.orgId}`} className="font-medium hover:text-amber-300">{c.name}</Link>
                  <div className="text-[11px] text-muted">{c.contactEmail} · {c.members} member{c.members === 1 ? '' : 's'}</div>
                </td>
                <td className="px-5 py-3">
                  <StatusPill status={c.status} />
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {c.mrrINR > 0 ? <span className="text-emerald-300">{inr(c.mrrINR)}</span> : <span className="text-muted">—</span>}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{c.enabledAgents}/5</td>
                <td className="px-5 py-3 text-right tabular-nums">{c.runs7d}</td>
                <td className="px-5 py-3 text-right tabular-nums text-muted">{compact(c.tokensEstimate)}</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {c.failures7d > 0 ? <span className="text-red-300">{c.failures7d}</span> : <span className="text-muted">0</span>}
                </td>
                <td className="px-5 py-3 text-right text-[11px] text-muted">
                  {c.lastActivity ? formatDistanceToNow(new Date(c.lastActivity), { addSuffix: true }) : '—'}
                </td>
              </tr>
            ))}
            {snap.customers.length === 0 && (
              <tr><td className="px-5 py-8 text-center text-sm text-muted" colSpan={8}>
                No customers yet. <Link href="/admin/companies/new" className="text-amber-300">Onboard the first one →</Link>
              </td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function RotatingHudRing() {
  return (
    <div className="relative hidden sm:block h-20 w-20 shrink-0">
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-[spin_16s_linear_infinite]">
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(251,146,60,0.4)" strokeWidth="0.5" strokeDasharray="4 6" />
      </svg>
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-[spin_28s_linear_infinite_reverse]">
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(56,189,248,0.3)" strokeWidth="0.5" strokeDasharray="2 8" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400/60 to-orange-600/60 shadow-[0_0_24px_rgba(251,146,60,0.5)]
                        flex items-center justify-center text-black font-bold text-sm">
          A
        </div>
      </div>
    </div>
  )
}

function CornerTicks({ color = 'amber' }: { color?: 'amber' | 'red' }) {
  const stroke = color === 'red' ? 'rgba(248,113,113,0.5)' : 'rgba(251,146,60,0.5)'
  const positions = [
    { className: 'top-2 left-2', d: 'M 0 6 L 0 0 L 6 0' },
    { className: 'top-2 right-2', d: 'M 6 6 L 12 0 M 0 0 L 12 0' }
  ]
  return (
    <>
      <svg className="absolute top-2 left-2 h-3 w-3 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M 0 6 L 0 0 L 6 0" stroke={stroke} strokeWidth="1" />
      </svg>
      <svg className="absolute top-2 right-2 h-3 w-3 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M 12 6 L 12 0 L 6 0" stroke={stroke} strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-2 left-2 h-3 w-3 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M 0 6 L 0 12 L 6 12" stroke={stroke} strokeWidth="1" />
      </svg>
      <svg className="absolute bottom-2 right-2 h-3 w-3 pointer-events-none" viewBox="0 0 12 12" fill="none">
        <path d="M 12 6 L 12 12 L 6 12" stroke={stroke} strokeWidth="1" />
      </svg>
    </>
  )
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: 'emerald' | 'cyan' | 'violet' | 'amber' | 'sky' | 'red' }) {
  const ring: Record<typeof accent, string> = {
    emerald: 'ring-emerald-400/30 shadow-emerald-500/10',
    cyan: 'ring-cyan-400/30 shadow-cyan-500/10',
    violet: 'ring-violet-400/30 shadow-violet-500/10',
    amber: 'ring-amber-400/30 shadow-amber-500/10',
    sky: 'ring-sky-400/30 shadow-sky-500/10',
    red: 'ring-red-400/30 shadow-red-500/10'
  }
  const text: Record<typeof accent, string> = {
    emerald: 'text-emerald-300', cyan: 'text-cyan-300', violet: 'text-violet-300',
    amber: 'text-amber-300', sky: 'text-sky-300', red: 'text-red-300'
  }
  const glow: Record<typeof accent, string> = {
    emerald: '0 0 14px rgba(52,211,153,0.35)',
    cyan: '0 0 14px rgba(56,189,248,0.35)',
    violet: '0 0 14px rgba(167,139,250,0.35)',
    amber: '0 0 14px rgba(251,191,36,0.35)',
    sky: '0 0 14px rgba(56,189,248,0.35)',
    red: '0 0 14px rgba(248,113,113,0.35)'
  }
  return (
    <div className={`relative rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-4 ring-1 ${ring[accent]} shadow-lg overflow-hidden`}>
      <CornerTicks color={accent === 'red' ? 'red' : 'amber'} />
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-mono tabular-nums ${text[accent]}`} style={{ textShadow: glow[accent] }}>{value}</p>
      {sub && <p className="text-[10px] text-muted/70 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20',
    trial: 'bg-sky-500/10 text-sky-300 ring-sky-400/20',
    suspended: 'bg-amber-500/10 text-amber-300 ring-amber-400/20',
    cancelled: 'bg-zinc-500/10 text-zinc-400 ring-zinc-400/20'
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ring-1 ${styles[status] || ''}`}>
      {status}
    </span>
  )
}
