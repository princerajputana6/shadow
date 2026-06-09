'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

type Props = {
  userName?: string
  userEmail?: string
  orgName?: string
  isPlatformAdmin?: boolean
  variant: 'member' | 'admin'
}

export function Topbar({ userName, userEmail, orgName, isPlatformAdmin, variant }: Props) {
  const [open, setOpen] = useState(false)
  const initials = (userName || userEmail || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <header className="h-14 flex items-center justify-between border-b border-cyan-500/10 bg-bg/60 backdrop-blur-xl px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {variant === 'admin' ? (
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-amber-300/80">Platform Admin</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/60">Org</span>
            <span className="text-sm font-medium text-text">{orgName || '—'}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Mode switcher — only visible to platform admins */}
        {isPlatformAdmin && (
          <ModeSwitcher variant={variant} />
        )}

        <div className="relative">
          <button onClick={() => setOpen(v => !v)}
                  className="flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-bg/50 px-1.5 py-1">
            <div className={`h-7 w-7 rounded-full text-xs font-semibold flex items-center justify-center ${
              variant === 'admin' ? 'bg-amber-500/20 text-amber-200' : 'bg-cyan-500/20 text-cyan-200'
            }`}>
              {initials}
            </div>
            <span className="hidden sm:block text-xs pr-2 max-w-[140px] truncate">{userName || userEmail}</span>
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-cyan-500/20 bg-surface/95 backdrop-blur-xl shadow-2xl z-40 p-1.5">
                <div className="px-3 py-2 border-b border-cyan-500/10">
                  <p className="text-sm font-medium truncate">{userName || 'User'}</p>
                  <p className="text-[11px] text-muted truncate">{userEmail}</p>
                  {isPlatformAdmin && (
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 mt-1">Platform Admin</p>
                  )}
                </div>
                <Link href="/settings" className="block px-3 py-1.5 text-sm rounded-md hover:bg-bg/50">Settings</Link>
                {isPlatformAdmin && variant === 'member' && (
                  <Link href="/admin" className="block px-3 py-1.5 text-sm rounded-md hover:bg-bg/50">Platform admin</Link>
                )}
                {isPlatformAdmin && variant === 'admin' && (
                  <Link href="/dashboard" className="block px-3 py-1.5 text-sm rounded-md hover:bg-bg/50">My agents (AgentOS HQ)</Link>
                )}
                <button onClick={() => signOut({ callbackUrl: '/login' })}
                        className="w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-bg/50 text-red-300">
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function ModeSwitcher({ variant }: { variant: 'member' | 'admin' }) {
  if (variant === 'admin') {
    return (
      <Link href="/dashboard"
            className="group relative inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/5 px-3 py-1.5 text-xs
                       hover:bg-cyan-500/10 transition">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="uppercase tracking-wider text-cyan-200">My Agents</span>
        <span className="text-cyan-300/60 group-hover:translate-x-0.5 transition">→</span>
      </Link>
    )
  }
  return (
    <Link href="/admin"
          className="group relative inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/5 px-3 py-1.5 text-xs
                     hover:bg-amber-500/10 transition">
      <span className="text-amber-300/60 group-hover:-translate-x-0.5 transition">←</span>
      <span className="uppercase tracking-wider text-amber-200">Platform Admin</span>
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
    </Link>
  )
}
