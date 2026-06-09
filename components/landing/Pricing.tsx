'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Reveal } from './Reveal'

type Tier = {
  name: string
  tagline: string
  monthly: number
  annualMonthly: number    // monthly price when billed annually
  agents: string[]
  runs: number            // monthly run cap before top-ups kick in
  features: string[]
  cta: string
  popular?: boolean
  accent: 'cyan' | 'amber' | 'violet'
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    tagline: 'For solo founders running their first agent.',
    monthly: 2999,
    annualMonthly: 2499,
    agents: ['Pick any 1'],
    runs: 500,
    features: [
      'Pick any 1 agent',
      '500 runs / month',
      'Daily voice + email briefings',
      'Email support · 48h SLA',
      'Encrypted token storage'
    ],
    cta: 'Start with 1 agent',
    accent: 'cyan'
  },
  {
    name: 'Growth',
    tagline: 'For small teams scaling outreach + content.',
    monthly: 9999,
    annualMonthly: 8333,
    agents: ['Pick any 3'],
    runs: 2000,
    features: [
      'Pick any 3 agents',
      '2,000 runs / month',
      'Discovery enrichment (Hunter.io)',
      'Slack integration',
      'Priority support · 24h SLA',
      'Per-business search profiles'
    ],
    cta: 'Most teams pick this',
    popular: true,
    accent: 'amber'
  },
  {
    name: 'Scale',
    tagline: 'Full crew — every specialist working in parallel.',
    monthly: 24999,
    annualMonthly: 20833,
    agents: ['All 6 agents'],
    runs: 8000,
    features: [
      'All 5 specialist agents + Orchestrator',
      '8,000 runs / month',
      'GitHub + Jira + Bitbucket OAuth',
      'Custom agent prompts',
      'Dedicated Slack channel · 4h SLA',
      'Quarterly business review'
    ],
    cta: 'Run the full crew',
    accent: 'violet'
  },
  {
    name: 'Enterprise',
    tagline: 'Custom agents, SSO, audit log, dedicated infra.',
    monthly: 0, // displayed as "Talk to us"
    annualMonthly: 0,
    agents: ['All 6 agents + custom'],
    runs: 0, // unlimited
    features: [
      'Everything in Scale',
      'Unlimited runs',
      'Custom agent templates',
      'SSO via SAML / OIDC',
      'Audit log + SOC2 prep',
      'Dedicated infra + named CSM'
    ],
    cta: 'Talk to founder',
    accent: 'cyan'
  }
]

const ACCENT: Record<Tier['accent'], { ring: string; text: string; glow: string; grad: string }> = {
  cyan: {
    ring: 'ring-cyan-400/30 hover:ring-cyan-400/60',
    text: 'text-cyan-300',
    glow: 'shadow-cyan-500/20',
    grad: 'from-cyan-500/10 to-transparent'
  },
  amber: {
    ring: 'ring-amber-400/40 hover:ring-amber-400/70',
    text: 'text-amber-300',
    glow: 'shadow-amber-500/30',
    grad: 'from-amber-500/15 to-orange-500/5'
  },
  violet: {
    ring: 'ring-violet-400/30 hover:ring-violet-400/60',
    text: 'text-violet-300',
    glow: 'shadow-violet-500/20',
    grad: 'from-violet-500/10 to-transparent'
  }
}

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="relative py-24 px-6">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Realistic per-agent pricing.<br />
              <span className="text-muted">Pay only for the specialists you actually need.</span>
            </h2>
          </div>

          <div className="flex items-center gap-3 mb-10">
            <span className={`text-xs ${!annual ? 'text-text' : 'text-muted'}`}>Monthly</span>
            <button onClick={() => setAnnual(v => !v)}
                    className={`relative h-7 w-12 rounded-full border transition ${
                      annual ? 'bg-amber-500/20 border-amber-400/40' : 'bg-bg/60 border-border'
                    }`}>
              <motion.span layout
                           className={`absolute top-0.5 h-6 w-6 rounded-full bg-gradient-to-br ${
                             annual ? 'from-amber-300 to-orange-500 left-[1.4rem]' : 'from-zinc-300 to-zinc-500 left-0.5'
                           }`} />
            </button>
            <span className={`text-xs ${annual ? 'text-text' : 'text-muted'}`}>Annual</span>
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 rounded-full bg-emerald-500/10 px-2 py-0.5 ring-1 ring-emerald-400/30">
              2 months free
            </span>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((t) => {
            const acc = ACCENT[t.accent]
            const price = annual ? t.annualMonthly : t.monthly
            return (
              <motion.article key={t.name}
                              whileHover={{ y: -4 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                              className={`relative rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-6
                                          ring-1 ${acc.ring} shadow-xl ${acc.glow} ${t.popular ? 'lg:scale-105 z-10' : ''}`}>
                {/* Popular pill */}
                {t.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[10px] uppercase tracking-wider text-black font-semibold shadow-lg shadow-amber-500/40">
                    Most popular
                  </div>
                )}
                {/* Accent glow corner */}
                <div className={`absolute -top-px -right-px h-24 w-24 rounded-2xl bg-gradient-to-br ${acc.grad} pointer-events-none`} />

                <div className="relative">
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <p className="mt-1 text-xs text-muted min-h-[2.5rem]">{t.tagline}</p>

                  <div className="mt-5">
                    {t.monthly > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <AnimatePresence mode="popLayout">
                          <motion.span key={price}
                                       initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                                       className={`text-3xl font-semibold tabular-nums ${acc.text}`}>
                            ₹{price.toLocaleString('en-IN')}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-xs text-muted">/ month{annual && <span className="text-emerald-300"> billed yearly</span>}</span>
                      </div>
                    ) : (
                      <p className={`text-3xl font-semibold ${acc.text}`}>Custom</p>
                    )}
                  </div>

                  <a href="#signup"
                     className={`mt-5 block text-center rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                       t.popular
                         ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50'
                         : 'border border-cyan-400/30 bg-cyan-500/5 text-cyan-200 hover:bg-cyan-500/10'
                     }`}>
                    {t.cta}
                  </a>

                  <ul className="mt-6 pt-5 border-t border-cyan-500/10 space-y-2.5 text-sm">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`mt-0.5 text-base ${acc.text}`}>✓</span>
                        <span className="text-text/85">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {t.monthly > 0 && (
                    <div className="mt-5 pt-4 border-t border-cyan-500/10 text-[10px] uppercase tracking-[0.16em] text-muted">
                      Includes {t.runs.toLocaleString('en-IN')} runs · ₹{(Math.round((price / t.runs) * 1000) / 1000).toFixed(2)} per run
                    </div>
                  )}
                </div>
              </motion.article>
            )
          })}
        </div>

        <Reveal delay={0.2}>
          <p className="mt-10 text-xs text-muted text-center">
            All plans include encrypted OAuth, daily briefings, lifetime upgrades.
            Cancel any time — your data exports as CSV in one click.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
