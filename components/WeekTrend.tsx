'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

export function WeekTrend({ data }: { data: { _id: string; count: number }[] }) {
  // Build a complete 7-day series (fill missing days with 0)
  const today = new Date()
  const series: { day: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000)
    const ist = new Date(d.getTime() + 5.5 * 3600_000)
    const key = ist.toISOString().slice(0, 10)
    const hit = data.find((x) => x._id === key)
    series.push({
      day: ist.toLocaleDateString('en-IN', { weekday: 'short' }),
      count: hit?.count ?? 0
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-medium">New leads · last 7 days</h2>
      <div className="mt-3 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb923c" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
            <Tooltip
              contentStyle={{ background: '#141417', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Area type="monotone" dataKey="count" stroke="#fb923c" fill="url(#g)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
