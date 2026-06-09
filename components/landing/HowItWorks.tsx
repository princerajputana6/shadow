'use client'

import { Reveal, Stagger, StaggerItem } from './Reveal'

const STEPS = [
  {
    num: '01',
    title: 'Connect your stack',
    body: 'Google Workspace, GitHub, Bitbucket, Jira, Slack. OAuth flows handle the trust. Tokens encrypted with AES-256-GCM at rest.',
    detail: 'Most setups complete in ~10 minutes.'
  },
  {
    num: '02',
    title: 'Tell us about your business',
    body: 'Paste your website URL — our extractor reads your homepage and builds your customer profile, ideal-customer description, and buyer-intent search keywords.',
    detail: 'Editable any time at /businesses.'
  },
  {
    num: '03',
    title: 'Agents start working',
    body: 'Researcher discovers leads, Sales Rep does outreach on opt-in only, CMO drafts posts, Dev opens draft PRs. Everything human-reviewable before it ships.',
    detail: 'Crons run every 6 hours by default.'
  },
  {
    num: '04',
    title: 'You review &amp; approve',
    body: 'Each morning at 6 AM IST you get a one-paragraph debrief in voice or text. Approve PRs, send replies, take meetings. Cancel any time.',
    detail: 'No auto-merges. No surprise sends.'
  }
]

export function HowItWorks() {
  return (
    <section className="relative py-24 px-6 border-y border-cyan-500/10">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/70 mb-3">From signup to outcomes</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Four steps. <span className="text-muted">No fluff.</span>
            </h2>
          </div>
        </Reveal>

        <Stagger gap={0.1}>
          <ol className="space-y-px">
            {STEPS.map((s, i) => (
              <StaggerItem key={s.num}>
                <li className="group grid grid-cols-12 gap-6 items-start py-8 border-t border-cyan-500/10
                               first:border-t-0 hover:bg-cyan-500/5 transition-colors duration-300 -mx-6 px-6 rounded-lg">
                  <div className="col-span-12 sm:col-span-2">
                    <p className="text-3xl font-mono text-cyan-300/40 tabular-nums">{s.num}</p>
                  </div>
                  <div className="col-span-12 sm:col-span-7">
                    <h3 className="text-xl font-semibold" dangerouslySetInnerHTML={{ __html: s.title }} />
                    <p className="mt-2 text-base text-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: s.body }} />
                  </div>
                  <div className="col-span-12 sm:col-span-3 flex sm:justify-end">
                    <p className="text-xs uppercase tracking-[0.16em] text-amber-300/70">{s.detail}</p>
                  </div>
                  <div className="col-span-12 ml-auto sm:mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase tracking-wider text-cyan-400">{i < STEPS.length - 1 ? '↓ continue' : '✓ live'}</span>
                  </div>
                </li>
              </StaggerItem>
            ))}
          </ol>
        </Stagger>
      </div>
    </section>
  )
}
