import { format } from 'date-fns'

type Row = {
  _id: string
  title: string
  scheduledAt: string | Date
  meetLink?: string
}

export function MeetingsCard({ meetings }: { meetings: Row[] }) {
  return (
    <aside className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-muted">Upcoming meetings</h2>
      {!meetings.length ? (
        <p className="mt-3 text-sm text-muted">Nothing booked yet today.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {meetings.slice(0, 6).map((m) => (
            <li key={String(m._id)} className="text-sm">
              <div className="font-medium">{m.title}</div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{format(new Date(m.scheduledAt), 'EEE d MMM, HH:mm')}</span>
                {m.meetLink && (
                  <a href={m.meetLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Join
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
