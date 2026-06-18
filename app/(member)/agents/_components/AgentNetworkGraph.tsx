'use client'

import { motion } from 'framer-motion'
import type { AgentStatusRow } from '@/lib/agentRoster'

const ACCENT: Record<string, { grad: string; ring: string; glow: string; text: string }> = {
  violet:  { grad: 'from-violet-500/40 to-violet-700/40',   ring: 'ring-violet-400/40',  glow: 'shadow-violet-500/30',  text: 'text-violet-200' },
  sky:     { grad: 'from-sky-500/40 to-sky-700/40',         ring: 'ring-sky-400/40',     glow: 'shadow-sky-500/30',     text: 'text-sky-200' },
  orange:  { grad: 'from-orange-500/40 to-orange-700/40',   ring: 'ring-orange-400/40',  glow: 'shadow-orange-500/30',  text: 'text-orange-200' },
  amber:   { grad: 'from-amber-500/40 to-amber-700/40',     ring: 'ring-amber-400/40',   glow: 'shadow-amber-500/30',   text: 'text-amber-200' },
  emerald: { grad: 'from-emerald-500/40 to-emerald-700/40', ring: 'ring-emerald-400/40', glow: 'shadow-emerald-500/30', text: 'text-emerald-200' },
  fuchsia: { grad: 'from-fuchsia-500/40 to-fuchsia-700/40', ring: 'ring-fuchsia-400/40', glow: 'shadow-fuchsia-500/30', text: 'text-fuchsia-200' }
}

export function AgentNetworkGraph({ roster, ceoStats }: {
  roster: AgentStatusRow[]
  ceoStats: { routes: number; runs: number; model: string }
}) {
  const ceo = roster.find(r => r.key === 'ceo')!
  const specialists = roster.filter(r => r.key !== 'ceo')

  return (
    <section className="relative">
      {/* SVG connecting lines (decorative, behind cards) */}
      <svg className="pointer-events-none absolute inset-x-0 top-[170px] h-32 w-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.5)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.5)" />
          </linearGradient>
        </defs>
        {specialists.map((_, i) => {
          const cx = 500
          const cy = 0
          const tx = 100 + (i * 200)
          const ty = 90
          return (
            <path key={i}
                  d={`M ${cx} ${cy} C ${cx} ${cy + 40}, ${tx} ${ty - 40}, ${tx} ${ty}`}
                  fill="none"
                  stroke="url(#line-grad)"
                  strokeWidth="1"
                  strokeDasharray="3 3" />
          )
        })}
      </svg>

      {/* CEO Orchestrator card (centered) */}
      <div className="flex justify-center mb-16">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`relative rounded-2xl border border-violet-400/30 bg-gradient-to-br ${ACCENT.violet.grad} backdrop-blur p-5 w-[420px] shadow-xl ${ACCENT.violet.glow}`}>
          <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-400/20 to-transparent pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {ceo.status === 'working' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                    <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> working
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-muted/60 rounded-full ring-1 ring-border px-2 py-0.5">idle</span>
                )}
              </div>
              <h3 className="mt-2 text-xl font-semibold">CEO/Orchestrator</h3>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{ceo.roleTitle}</p>
              <p className="mt-2 text-sm text-text/80 max-w-xs leading-snug">{ceo.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted">Routes</p>
                <p className="text-lg font-mono tabular-nums text-text">{ceoStats.routes}</p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted">Runs</p>
                <p className="text-lg font-mono tabular-nums text-text">{ceoStats.runs}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-violet-400/20">
                <p className="text-[9px] uppercase tracking-wider text-muted">Model</p>
                <p className="text-[11px] font-mono text-violet-200">{ceoStats.model}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Specialist row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {specialists.map((a, i) => {
          const acc = ACCENT[a.accent] || ACCENT.sky
          return (
            <motion.div key={a.key} id={a.key}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        className={`relative rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-4 ring-1 ${acc.ring} hover:shadow-lg ${acc.glow} transition`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${acc.grad} flex items-center justify-center ring-1 ${acc.ring}`}>
                  <span className={`text-base ${acc.text}`}>{a.icon}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
              <h4 className="font-semibold">{a.name}</h4>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{a.roleTitle}</p>
              <p className="mt-2 text-xs text-text/70 leading-snug min-h-[3rem]">{a.description}</p>
              <div className="mt-3 pt-3 border-t border-cyan-500/10">
                <p className="text-[9px] uppercase tracking-wider text-muted">Model</p>
                <p className={`text-[11px] font-mono ${acc.text}`}>{a.model}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: AgentStatusRow['status'] }) {
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
        <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" /> working
      </span>
    )
  }
  if (status === 'failed') {
    return <span className="text-[9px] uppercase tracking-wider text-red-300 rounded-full bg-red-500/10 px-1.5 py-0.5">failed</span>
  }
  return <span className="text-[9px] uppercase tracking-wider text-muted/60 rounded-full ring-1 ring-border px-1.5 py-0.5">idle</span>
}
