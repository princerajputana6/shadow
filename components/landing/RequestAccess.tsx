'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Reveal } from './Reveal'

const AGENTS = [
  { key: 'sales_finder', label: 'Sales Rep' },
  { key: 'lead_discovery', label: 'Researcher' },
  { key: 'social_media', label: 'CMO' },
  { key: 'cto', label: 'CTO + Dev' },
  { key: 'developer', label: 'Dev only' }
]

const SIZES = [
  { value: '1-10', label: '1–10' },
  { value: '11-50', label: '11–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-1000', label: '201–1,000' },
  { value: '1000+', label: '1,000+' }
]

const BUDGETS = [
  { value: 'under_10k', label: 'Under ₹10k/mo' },
  { value: '10k_30k', label: '₹10k – ₹30k/mo' },
  { value: '30k_75k', label: '₹30k – ₹75k/mo' },
  { value: '75k_plus', label: '₹75k+/mo' },
  { value: 'unsure', label: 'Not sure yet' }
]

export function RequestAccess() {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', company: '', phone: '', website: '',
    companySize: '11-50', interestedAgents: ['sales_finder'] as string[],
    budgetRange: '10k_30k', message: ''
  })

  function toggleAgent(key: string) {
    setForm(f => ({
      ...f,
      interestedAgents: f.interestedAgents.includes(key)
        ? f.interestedAgents.filter(k => k !== key)
        : [...f.interestedAgents, key]
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: typeof document !== 'undefined' ? document.referrer : '' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setDone(data?.message || 'Got it.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="signup" className="relative py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="mb-10 max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70 mb-3">Request access</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Tell us about your business.<br />
              <span className="text-muted">We'll be in touch within 24 hours.</span>
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative">
            {/* Holographic frame */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-amber-400/30 via-cyan-400/20 to-violet-400/30 opacity-50 blur-md" />
            <div className="relative rounded-2xl border border-cyan-400/20 bg-surface/85 backdrop-blur-xl p-7 sm:p-9">
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.div key="done"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-center py-12">
                    <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/40 flex items-center justify-center">
                      <span className="text-3xl text-emerald-300">✓</span>
                    </div>
                    <h3 className="text-2xl font-semibold">Got it.</h3>
                    <p className="mt-2 text-muted">{done}</p>
                    <p className="mt-6 text-xs text-muted/70">In the meantime, you can <a href="#pricing" className="text-amber-300 hover:underline">review our pricing</a> or read the <a href="/login" className="text-amber-300 hover:underline">platform docs</a>.</p>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={submit}
                               initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                               className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <Field label="Your name" required>
                        <input className={cls} required placeholder="Prince Rajput"
                               value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                      </Field>
                      <Field label="Work email" required>
                        <input type="email" className={cls} required placeholder="prince@biztreck.world"
                               value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                      </Field>
                      <Field label="Company name" required>
                        <input className={cls} required placeholder="Biztreck"
                               value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
                      </Field>
                      <Field label="Company website">
                        <input type="url" className={cls} placeholder="https://"
                               value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
                      </Field>
                      <Field label="Phone (optional)">
                        <input className={cls} placeholder="+91 ..."
                               value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                      </Field>
                      <Field label="Company size" required>
                        <select className={cls} value={form.companySize}
                                onChange={e => setForm({ ...form, companySize: e.target.value })}>
                          {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </Field>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted mb-2">Which agents are you interested in?</label>
                      <div className="flex flex-wrap gap-2">
                        {AGENTS.map(a => {
                          const on = form.interestedAgents.includes(a.key)
                          return (
                            <button key={a.key} type="button" onClick={() => toggleAgent(a.key)}
                                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                      on
                                        ? 'border-amber-400/50 bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30'
                                        : 'border-border bg-bg/60 text-muted hover:text-text'
                                    }`}>
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <Field label="Monthly budget" required>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {BUDGETS.map(b => (
                          <button key={b.value} type="button"
                                  onClick={() => setForm({ ...form, budgetRange: b.value })}
                                  className={`rounded-md border px-2 py-2 text-xs transition ${
                                    form.budgetRange === b.value
                                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30'
                                      : 'border-border bg-bg/60 text-muted hover:text-text'
                                  }`}>
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="Anything else we should know? (optional)">
                      <textarea rows={3} className={cls} placeholder="Tell us about your team, your biggest bottleneck, or anything specific."
                                value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                    </Field>

                    {err && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-cyan-500/10">
                      <p className="text-[11px] text-muted/70 max-w-md">
                        By submitting you agree to our terms. We never share your details. You can opt out any time.
                      </p>
                      <button type="submit" disabled={busy}
                              className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-semibold text-black shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition disabled:opacity-50">
                        {busy ? 'Sending…' : 'Request access →'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const cls = 'w-full rounded-lg border border-cyan-500/20 bg-bg/60 px-3 py-2.5 text-sm placeholder:text-muted/40 focus:border-cyan-400/50 focus:outline-none transition'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-muted mb-2">
        {label} {required && <span className="text-amber-300">·</span>}
      </label>
      {children}
    </div>
  )
}
