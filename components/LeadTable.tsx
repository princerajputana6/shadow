import type { LeadDoc } from '@/models/Lead'

type Row = Pick<LeadDoc, 'name' | 'email' | 'company' | 'requirement' | 'urgency' | 'status' | 'createdAt'> & { _id: string }

export function LeadTable({ leads }: { leads: Row[] }) {
  if (!leads.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        No leads yet. Once the sales agent processes replies, qualified leads land here.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-bg text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Lead</th>
            <th className="px-4 py-2 font-medium">Requirement</th>
            <th className="px-4 py-2 font-medium">Urgency</th>
            <th className="px-4 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={String(l._id)} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium">{l.name || l.email}</div>
                <div className="text-xs text-muted">{l.company || l.email}</div>
              </td>
              <td className="px-4 py-3 capitalize">{l.requirement || '—'}</td>
              <td className="px-4 py-3">
                <UrgencyBar value={l.urgency} />
              </td>
              <td className="px-4 py-3">
                <StatusPill status={l.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UrgencyBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value * 10))
  const color = value >= 8 ? 'bg-red-500' : value >= 5 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-bg overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted">{value}/10</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-emerald-500/10 text-emerald-400',
    in_conversation: 'bg-sky-500/10 text-sky-400',
    meeting_scheduled: 'bg-violet-500/10 text-violet-400',
    proposal_sent: 'bg-amber-500/10 text-amber-300',
    won: 'bg-emerald-500/20 text-emerald-300',
    lost: 'bg-zinc-500/10 text-zinc-400'
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] || 'bg-zinc-500/10 text-zinc-400'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
