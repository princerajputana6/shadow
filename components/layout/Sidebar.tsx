'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './Icon'
import type { AgentStatusRow } from '@/lib/agentRoster'

type NavItem = { href: string; label: string; icon: Parameters<typeof Icon>[0]['name'] }
type Section = { title?: string; items: NavItem[] }

const MEMBER_SECTIONS: Section[] = [
  { items: [{ href: '/dashboard', label: 'Command Center', icon: 'dashboard' }] },
  {
    title: 'Operations',
    items: [
      { href: '/agents', label: 'Agents', icon: 'bot' },
      { href: '/tasks', label: 'Tasks', icon: 'code' },
      { href: '/businesses', label: 'Businesses', icon: 'briefcase' }
    ]
  },
  {
    title: 'Pipeline',
    items: [
      { href: '/leads', label: 'Lead Pipeline', icon: 'leads' },
      { href: '/meetings', label: 'Meetings', icon: 'calendar' },
      { href: '/discovery', label: 'Discovery', icon: 'search' }
    ]
  },
  {
    title: 'Growth',
    items: [
      { href: '/social', label: 'Content', icon: 'share' }
    ]
  },
  {
    title: 'Account',
    items: [
      { href: '/integrations', label: 'Integrations', icon: 'share' },
      { href: '/settings', label: 'Settings', icon: 'settings' }
    ]
  }
]

const ADMIN_SECTIONS: Section[] = [
  { items: [{ href: '/admin', label: 'Overview', icon: 'dashboard' }] },
  {
    title: 'Platform',
    items: [
      { href: '/admin/companies', label: 'Companies', icon: 'building' },
      { href: '/admin/billing', label: 'Billing', icon: 'receipt' },
      { href: '/admin/users', label: 'Users', icon: 'users' }
    ]
  },
  {
    title: 'Switch',
    items: [{ href: '/dashboard', label: '← Command Center', icon: 'logout' }]
  }
]

export function Sidebar({ variant, roster, isPlatformAdmin }: {
  variant: 'member' | 'admin'
  roster?: AgentStatusRow[]
  isPlatformAdmin?: boolean
}) {
  const pathname = usePathname()
  const sections = variant === 'admin' ? ADMIN_SECTIONS : MEMBER_SECTIONS

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-cyan-500/10 bg-surface/60 backdrop-blur-xl">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-cyan-500/10">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
          <div className="absolute inset-0 rounded-xl bg-cyan-400/20 animate-pulse" />
          <span className="relative text-bg font-bold text-sm">A</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">AgentOS</div>
          <div className="text-[9px] text-cyan-300/70 uppercase tracking-[0.18em]">
            {variant === 'admin' ? 'Platform Admin' : 'Agentic Growth Operations'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <div className="px-2 mb-1.5 text-[9px] uppercase tracking-[0.2em] text-muted/60">{section.title}</div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href ||
                  (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <Link href={item.href}
                          className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition
                            ${active
                              ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/20'
                              : 'text-muted hover:text-text hover:bg-bg/40'}`}>
                      <Icon name={item.icon} className={`h-4 w-4 ${active ? 'text-cyan-300' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Platform Admin entrypoint — only for users with the flag, only in member mode */}
        {variant === 'member' && isPlatformAdmin && (
          <div className="pt-3 mt-3 border-t border-cyan-500/10">
            <div className="px-2 mb-1.5 text-[9px] uppercase tracking-[0.2em] text-amber-300/70">Platform Admin</div>
            <ul className="space-y-0.5">
              <li>
                <Link href="/admin"
                      className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm
                                 text-amber-200/90 hover:text-amber-100 hover:bg-amber-500/5 ring-1 ring-amber-500/10">
                  <Icon name="admin" className="h-4 w-4" />
                  <span>SaaS Admin →</span>
                </Link>
              </li>
            </ul>
          </div>
        )}

        {/* Agent roster — member only */}
        {variant === 'member' && roster && roster.length > 0 && (
          <div className="pt-3 mt-3 border-t border-cyan-500/10">
            <div className="px-2 mb-2 text-[9px] uppercase tracking-[0.2em] text-muted/60">Agents</div>
            <ul className="space-y-1">
              {roster.map(agent => (
                <li key={agent.key}>
                  <Link href={`/agents#${agent.key}`}
                        className="group block rounded-lg px-2.5 py-1.5 hover:bg-bg/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-medium uppercase tracking-wider text-text/90 truncate">
                          {agent.name}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.15em] text-muted/60 truncate">
                          {agent.roleTitle}
                        </div>
                      </div>
                      <StatusPill status={agent.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-muted">
        <span>v0.1 · Phase 1</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300/80">ONLINE</span>
        </span>
      </div>
    </aside>
  )
}

function StatusPill({ status }: { status: 'working' | 'idle' | 'failed' | 'never_run' }) {
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30">
        <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
        working
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider bg-red-500/10 text-red-300 ring-1 ring-red-400/30">
        failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted/60 ring-1 ring-border">
      idle
    </span>
  )
}
