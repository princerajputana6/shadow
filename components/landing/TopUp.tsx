'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Reveal } from './Reveal'

const PACKS = [
  { credits: 500, price: 999, perRun: 2.0 },
  { credits: 1500, price: 2499, perRun: 1.67, popular: true },
  { credits: 4000, price: 5999, perRun: 1.5 },
  { credits: 10000, price: 13999, perRun: 1.4 }
]

export function TopUp() {
  const [tierRuns, setTierRuns] = useState(2000)
  const [needed, setNeeded] = useState(2500)
  const overage = Math.max(0, needed - tierRuns)
  const bestPack = PACKS.find(p => p.credits >= overage) || PACKS[PACKS.length - 1]
  const extraCost = overage > 0 ? bestPack.price : 0

  return (
    <section className="relative py-24 px-6 border-y border-amber-500/10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-3">Top-up credits</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Burst above your plan?<br />
              <span className="text-muted">Top up with pay-as-you-go credits.</span>
            </h2>
            <p className="mt-4 text-sm text-muted max-w-xl leading-relaxed">
              Every agent run consumes 1 credit. Your plan includes a monthly bucket;
              extra credits roll over for 90 days. Buy bigger packs for a lower per-run rate.
            </p>
          </div>
        </Reveal>

        {/* Credit packs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-12">
          {PACKS.map((p) => (
            <motion.div key={p.credits}
                        whileHover={{ y: -3 }}
                        className={`relative rounded-2xl border bg-surface/60 backdrop-blur p-5
                                    ${p.popular ? 'border-amber-400/50 ring-1 ring-amber-400/30 shadow-xl shadow-amber-500/20' : 'border-cyan-500/10 ring-1 ring-cyan-400/15'}`}>
              {p.popular && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-amber-400 text-black text-[10px] uppercase tracking-wider px-2 py-0.5 font-semibold">
                  Best value
                </span>
              )}
              <p className="text-[10px] uppercase tracking-wider text-muted">Credits</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{p.credits.toLocaleString('en-IN')}</p>
              <p className="mt-3 text-xl font-mono tabular-nums">₹{p.price.toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-muted mt-0.5">₹{p.perRun.toFixed(2)} / run</p>
              <a href="#signup" className={`mt-4 block text-center rounded-md px-3 py-1.5 text-xs font-medium ${
                p.popular ? 'bg-amber-400 text-black' : 'border border-cyan-400/30 text-cyan-200 hover:bg-cyan-500/10'
              }`}>
                Buy pack
              </a>
            </motion.div>
          ))}
        </div>

        {/* Interactive calculator */}
        <Reveal>
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-bg/60 to-cyan-500/5 backdrop-blur p-6">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-2">Cost calculator</h3>
            <p className="text-sm text-muted">Estimate your monthly bill based on how many agent runs you actually need.</p>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted">Plan run bucket</span>
                    <span className="text-text tabular-nums">{tierRuns.toLocaleString('en-IN')} runs/mo</span>
                  </div>
                  <input type="range" min={500} max={8000} step={500} value={tierRuns}
                         onChange={(e) => setTierRuns(Number(e.target.value))}
                         className="w-full accent-amber-400" />
                  <div className="flex justify-between text-[10px] text-muted mt-1">
                    <span>Starter 500</span>
                    <span>Growth 2k</span>
                    <span>Scale 8k</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-muted">Estimated monthly runs</span>
                    <span className="text-text tabular-nums">{needed.toLocaleString('en-IN')} runs</span>
                  </div>
                  <input type="range" min={100} max={20000} step={100} value={needed}
                         onChange={(e) => setNeeded(Number(e.target.value))}
                         className="w-full accent-cyan-400" />
                </div>
              </div>

              <div className="rounded-xl border border-cyan-500/10 bg-bg/60 p-5">
                <p className="text-[10px] uppercase tracking-wider text-muted">Outcome</p>
                {overage === 0 ? (
                  <>
                    <p className="mt-2 text-2xl font-semibold text-emerald-300">You're covered ✓</p>
                    <p className="text-xs text-muted mt-1">
                      Your plan handles {tierRuns.toLocaleString('en-IN')} runs — you're using {needed.toLocaleString('en-IN')}. No top-up needed.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xl text-amber-300">
                      Buy <span className="text-2xl font-semibold">{bestPack.credits.toLocaleString('en-IN')}</span> credit pack
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Covers your {overage.toLocaleString('en-IN')} extra runs · ₹{extraCost.toLocaleString('en-IN')} one-time
                    </p>
                    <p className="text-xs text-muted mt-3 pt-3 border-t border-cyan-500/10">
                      Surplus {Math.max(0, bestPack.credits - overage).toLocaleString('en-IN')} credits roll over for 90 days.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
