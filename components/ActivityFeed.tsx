import { formatDistanceToNow } from 'date-fns'
import type { ActivityEvent } from '@/lib/stats'

const ICONS: Record<ActivityEvent['kind'], string> = {
  lead: '★',
  reply: '↩',
  meeting: '◆',
  run: '⟳',
  discovery: '⌕'
}
const COLORS: Record<ActivityEvent['kind'], string> = {
  lead: 'text-emerald-400',
  reply: 'text-sky-400',
  meeting: 'text-violet-400',
  run: 'text-amber-400',
  discovery: 'text-fuchsia-400'
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-medium">Activity</h2>
      {!events.length ? (
        <p className="mt-3 text-sm text-muted">Nothing yet — once the agents start firing, events show up here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {events.map((e, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className={`text-base leading-none mt-0.5 ${COLORS[e.kind]}`}>{ICONS[e.kind]}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate">{e.title}</p>
                {e.detail && <p className="text-xs text-muted truncate">{e.detail}</p>}
              </div>
              <span className="text-[11px] text-muted whitespace-nowrap">
                {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
