'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

// Animated grid + faint horizon line + headline. NO chatbot/robot iconography.
export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-32 lg:pt-40 lg:pb-44">
      {/* Animated grid backdrop */}
      <div aria-hidden className="absolute inset-0 z-0"
           style={{
             backgroundImage:
               'linear-gradient(rgba(56,189,248,0.07) 1px, transparent 1px),' +
               'linear-gradient(90deg, rgba(56,189,248,0.07) 1px, transparent 1px)',
             backgroundSize: '64px 64px',
             maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)'
           }} />
      {/* Slow scanline */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent z-0"
        animate={{ y: ['0vh', '100vh'] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
      {/* Holographic radial glow */}
      <div aria-hidden className="absolute inset-0 z-0"
           style={{
             background: 'radial-gradient(circle at 50% 0%, rgba(251,146,60,0.12), transparent 50%),' +
                        'radial-gradient(circle at 80% 100%, rgba(139,92,246,0.10), transparent 50%)'
           }} />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* System tag */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-8"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-300">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Shadow · v0.1 · India + UAE
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]"
        >
          Your business <br className="hidden sm:block" />
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-fuchsia-500 bg-clip-text text-transparent">
              runs itself.
            </span>
            <motion.span
              aria-hidden
              className="absolute -inset-x-2 -bottom-1 h-[2px] bg-gradient-to-r from-transparent via-orange-400 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              style={{ transformOrigin: 'left' }}
            />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-7 max-w-2xl text-lg text-muted leading-relaxed"
        >
          Six specialist agents — a CEO orchestrator, a researcher, a CMO, a sales rep,
          a developer, and a data analyst — find leads, draft posts, qualify replies,
          ship code, and book your meetings. While you focus on closing deals.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a href="#signup"
             className="group relative rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-3 text-sm font-semibold text-black shadow-xl shadow-amber-500/30 hover:shadow-amber-500/50 transition">
            Request access
            <span className="ml-2 inline-block transition group-hover:translate-x-1">→</span>
          </a>
          <a href="#pricing"
             className="rounded-lg border border-cyan-400/30 bg-cyan-500/5 backdrop-blur px-6 py-3 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10 transition">
            See pricing
          </a>
          <Link href="/login"
                className="text-sm text-muted hover:text-text transition">
            Already a customer? Sign in →
          </Link>
        </motion.div>

        {/* Live status strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl border border-cyan-500/10 bg-cyan-500/5 overflow-hidden font-mono text-xs"
        >
          {[
            { label: 'Uptime · 30d', value: '99.94%' },
            { label: 'Agent latency', value: '1.2s p50' },
            { label: 'Daily runs', value: '3.4k' },
            { label: 'Customers', value: '7 paying' }
          ].map(s => (
            <div key={s.label} className="bg-bg/60 backdrop-blur p-4">
              <p className="text-[10px] uppercase tracking-wider text-cyan-300/60">{s.label}</p>
              <p className="mt-1 text-base text-text">{s.value}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom diagonal divider */}
      <svg className="absolute bottom-0 inset-x-0 z-0 w-full h-12" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <line x1="0" y1="30" x2="1200" y2="30" stroke="rgba(56,189,248,0.15)" strokeDasharray="4 8" />
      </svg>
    </section>
  )
}
