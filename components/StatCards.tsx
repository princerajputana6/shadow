type Counts = {
  totalProspects: number
  optedInProspects: number
  contactedToday: number
  contactedTotal: number
  totalLeads: number
  newLeadsToday: number
  newLeadsWeek: number
  totalMeetings: number
  meetingsToday: number
  repliesToday: number
  wonLeads: number
  replyRate: number
  winRate: number
}

export function StatCards({ counts }: { counts: Counts }) {
  const cards = [
    { label: 'Prospects', value: counts.totalProspects, sub: `${counts.optedInProspects} opted in` },
    { label: 'Contacted today', value: counts.contactedToday, sub: `${counts.contactedTotal} all time` },
    { label: 'Replies today', value: counts.repliesToday, sub: `${counts.replyRate}% reply-to-lead` },
    { label: 'New leads today', value: counts.newLeadsToday, sub: `${counts.newLeadsWeek} last 7 days` },
    { label: 'Meetings today', value: counts.meetingsToday, sub: `${counts.totalMeetings} all time` },
    { label: 'Won deals', value: counts.wonLeads, sub: `${counts.winRate}% win rate` }
  ]
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs text-muted">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          <p className="mt-1 text-[11px] text-muted">{c.sub}</p>
        </div>
      ))}
    </section>
  )
}
