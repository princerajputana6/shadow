import { connectDB } from '@/lib/mongoose'
import SignupLead from '@/models/SignupLead'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { SignupRow } from './_components/SignupRow'

export const dynamic = 'force-dynamic'

const AGENT_LABEL: Record<string, string> = {
  sales_finder: 'Sales Rep',
  lead_discovery: 'Researcher',
  social_media: 'CMO',
  cto: 'CTO + Dev',
  developer: 'Dev'
}

const BUDGET_LABEL: Record<string, string> = {
  under_10k: '<₹10k',
  '10k_30k': '₹10–30k',
  '30k_75k': '₹30–75k',
  '75k_plus': '₹75k+',
  unsure: 'Unsure'
}

export default async function SignupsPage({ searchParams }: { searchParams: { status?: string } }) {
  await connectDB()
  const filter: Record<string, unknown> = {}
  if (searchParams.status && ['new', 'contacted', 'converted', 'rejected'].includes(searchParams.status)) {
    filter.status = searchParams.status
  }
  const signups = await SignupLead.find(filter).sort({ createdAt: -1 }).limit(200).lean()
  const counts = {
    new: await SignupLead.countDocuments({ status: 'new' }),
    contacted: await SignupLead.countDocuments({ status: 'contacted' }),
    converted: await SignupLead.countDocuments({ status: 'converted' }),
    rejected: await SignupLead.countDocuments({ status: 'rejected' })
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-1">Inbound</p>
        <h1 className="text-3xl font-semibold tracking-tight">Signup requests</h1>
        <p className="text-sm text-muted mt-1">Leads from the public landing page form.</p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs">
        <FilterPill href="/admin/signups" active={!searchParams.status} label="All" count={counts.new + counts.contacted + counts.converted + counts.rejected} />
        <FilterPill href="/admin/signups?status=new" active={searchParams.status === 'new'} label="New" count={counts.new} accent="amber" />
        <FilterPill href="/admin/signups?status=contacted" active={searchParams.status === 'contacted'} label="Contacted" count={counts.contacted} accent="sky" />
        <FilterPill href="/admin/signups?status=converted" active={searchParams.status === 'converted'} label="Converted" count={counts.converted} accent="emerald" />
        <FilterPill href="/admin/signups?status=rejected" active={searchParams.status === 'rejected'} label="Rejected" count={counts.rejected} accent="zinc" />
      </nav>

      {!signups.length ? (
        <div className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-8 text-sm text-muted text-center">
          No signups yet. Share your landing page to start collecting leads.
        </div>
      ) : (
        <ul className="space-y-3">
          {signups.map(s => (
            <SignupRow key={String(s._id)} signup={{
              _id: String(s._id),
              name: s.name,
              email: s.email,
              company: s.company,
              phone: s.phone,
              website: s.website,
              companySize: s.companySize,
              interestedAgents: (s.interestedAgents || []).map(k => AGENT_LABEL[k] || k),
              budgetLabel: BUDGET_LABEL[s.budgetRange] || s.budgetRange,
              message: s.message,
              status: s.status as 'new' | 'contacted' | 'converted' | 'rejected',
              createdAtRelative: formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })
            }} />
          ))}
        </ul>
      )}
    </div>
  )
}

function FilterPill({ href, active, label, count, accent = 'cyan' }: {
  href: string; active: boolean; label: string; count: number; accent?: 'amber' | 'sky' | 'emerald' | 'zinc' | 'cyan'
}) {
  const styles: Record<string, string> = {
    cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
    amber: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    sky: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
    emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
    zinc: 'border-zinc-400/20 bg-zinc-500/10 text-zinc-300'
  }
  return (
    <Link href={href}
          className={`rounded-full border px-3 py-1.5 transition ${
            active ? styles[accent] : 'border-border text-muted hover:text-text'
          }`}>
      {label} <span className="opacity-60 ml-1 tabular-nums">{count}</span>
    </Link>
  )
}
