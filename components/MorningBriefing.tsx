'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

type Props = {
  date?: string
  summaryText?: string
  stats: { prospectsContacted: number; repliesReceived: number; leadsQualified: number; meetingsBooked: number }
}

export function MorningBriefing({ date, summaryText, stats }: Props) {
  const [speaking, setSpeaking] = useState(false)

  function speak() {
    if (!summaryText || typeof window === 'undefined') return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    const u = new SpeechSynthesisUtterance(summaryText)
    u.rate = 0.95; u.lang = 'en-IN'
    u.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Morning briefing{date ? ` · ${date}` : ''}</h2>
        {summaryText && (
          <button onClick={speak} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-border/30">
            {speaking ? '■ Stop' : '▶ Listen'}
          </button>
        )}
      </div>
      <p className="mt-3 text-base leading-relaxed">
        {summaryText ?? 'No briefing yet — the sales agent runs at 6 AM IST. Tap "Run now" on the Sales Finder card to trigger a manual run.'}
      </p>
      <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Contacted" value={stats.prospectsContacted} />
        <Stat label="Replies" value={stats.repliesReceived} />
        <Stat label="Leads" value={stats.leadsQualified} />
        <Stat label="Meetings" value={stats.meetingsBooked} />
      </dl>
    </motion.section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
