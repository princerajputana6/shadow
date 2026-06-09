'use client'

import { motion } from 'framer-motion'
import { Reveal, Stagger, StaggerItem } from './Reveal'

// Six agents, presented with abstract geometric glyphs and very specific
// outcomes — no "AI assistant" platitudes.

type Agent = {
  glyph: string
  name: string
  role: string
  description: string
  outputs: string[]
  accent: 'amber' | 'cyan' | 'violet' | 'emerald' | 'sky' | 'fuchsia'
}

const AGENTS: Agent[] = [
  {
    glyph: '◆',
    name: 'CEO',
    role: 'Command layer',
    description: 'Reads your goals, routes work across the team, returns a one-paragraph debrief every morning.',
    outputs: ['Daily standup at 6 AM IST', 'Auto-routes incoming requests', 'Voice "Hey Shadow" interface'],
    accent: 'violet'
  },
  {
    glyph: '◎',
    name: 'Researcher',
    role: 'Intel gatherer',
    description: 'Surfaces companies with imminent spend signals — funding rounds, expansions, hiring waves.',
    outputs: ['Tavily + Hunter enrichment', '6 hourly intent queries', 'Output to review queue, never auto-contact'],
    accent: 'sky'
  },
  {
    glyph: '✦',
    name: 'Sales Rep',
    role: 'Revenue ops',
    description: 'Sends warm outreach, qualifies replies with Claude, books meetings on your calendar with Meet links.',
    outputs: ['Gmail OAuth (no SMTP)', 'Thread-aware dedup', 'Auto-creates Google Calendar slots'],
    accent: 'amber'
  },
  {
    glyph: '☼',
    name: 'CMO',
    role: 'Market voice',
    description: 'Drafts 5 posts per business per cycle — Twitter, LinkedIn, Instagram — in your tone.',
    outputs: ['Per-platform character limits', 'Tone calibration', 'Review queue + clipboard copy'],
    accent: 'fuchsia'
  },
  {
    glyph: '◈',
    name: 'Dev',
    role: 'Build system',
    description: 'Reads your GitHub repo, opens draft PRs against a feature branch with the change + a summary.',
    outputs: ['Octokit-driven file ops', 'Never auto-merges', 'CTO triage before code touches anything'],
    accent: 'emerald'
  },
  {
    glyph: '◇',
    name: 'Data Analyst',
    role: 'Signal layer',
    description: 'Token usage, conversion rates, agent failure trends, MRR — all in real-time.',
    outputs: ['Live token telemetry', 'Per-customer signal panel', 'Anomaly alerts to Slack'],
    accent: 'cyan'
  }
]

const ACCENT: Record<Agent['accent'], { grad: string; ring: string; text: string }> = {
  amber:   { grad: 'from-amber-500/25 to-amber-700/25',     ring: 'ring-amber-400/30',   text: 'text-amber-200' },
  cyan:    { grad: 'from-cyan-500/25 to-cyan-700/25',       ring: 'ring-cyan-400/30',    text: 'text-cyan-200' },
  violet:  { grad: 'from-violet-500/25 to-violet-700/25',   ring: 'ring-violet-400/30',  text: 'text-violet-200' },
  emerald: { grad: 'from-emerald-500/25 to-emerald-700/25', ring: 'ring-emerald-400/30', text: 'text-emerald-200' },
  sky:     { grad: 'from-sky-500/25 to-sky-700/25',         ring: 'ring-sky-400/30',     text: 'text-sky-200' },
  fuchsia: { grad: 'from-fuchsia-500/25 to-fuchsia-700/25', ring: 'ring-fuchsia-400/30', text: 'text-fuchsia-200' }
}

export function AgentGrid() {
  return (
    <section className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-3">The roster</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Six specialists. One orchestrator.<br />
              <span className="text-muted">Built to ship outcomes, not transcripts.</span>
            </h2>
          </div>
        </Reveal>

        <Stagger gap={0.08}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENTS.map((a) => {
              const acc = ACCENT[a.accent]
              return (
                <StaggerItem key={a.name}>
                  <motion.article
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className={`group relative h-full rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5 ring-1 ${acc.ring} overflow-hidden`}
                  >
                    {/* corner ticks */}
                    <svg className="absolute top-2 left-2 h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M 0 6 L 0 0 L 6 0" stroke="rgba(56,189,248,0.4)" strokeWidth="1" />
                    </svg>
                    <svg className="absolute top-2 right-2 h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M 12 6 L 12 0 L 6 0" stroke="rgba(56,189,248,0.4)" strokeWidth="1" />
                    </svg>

                    <div className="flex items-center gap-3 mb-4">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${acc.grad} ring-1 ${acc.ring} flex items-center justify-center text-lg ${acc.text} group-hover:scale-105 transition-transform`}>
                        {a.glyph}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{a.name}</h3>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">{a.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-text/80 leading-snug">{a.description}</p>
                    <ul className="mt-4 pt-4 border-t border-cyan-500/10 space-y-1.5">
                      {a.outputs.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted">
                          <span className={`mt-1 inline-block h-1 w-1 rounded-full ${acc.text}`} />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </motion.article>
                </StaggerItem>
              )
            })}
          </div>
        </Stagger>
      </div>
    </section>
  )
}
