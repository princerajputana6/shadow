'use client'

import { motion, useScroll, useMotionValueEvent } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

export function LandingNav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 40))

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled ? 'bg-bg/80 backdrop-blur-xl border-b border-cyan-500/10' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold shadow-lg shadow-amber-500/30">
            A
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Shadow</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-300/60">Agentic Growth OS</div>
          </div>
        </Link>

        <nav className="hidden sm:flex items-center gap-8 text-sm">
          <a href="#agents" className="text-muted hover:text-text transition">Agents</a>
          <a href="#how" className="text-muted hover:text-text transition">How it works</a>
          <a href="#pricing" className="text-muted hover:text-text transition">Pricing</a>
          <a href="#topup" className="text-muted hover:text-text transition">Top-ups</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline text-sm text-muted hover:text-text">Sign in</Link>
          <a href="#signup"
             className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 px-4 py-2 text-sm font-medium text-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition">
            Request access
          </a>
        </div>
      </div>
    </motion.header>
  )
}
