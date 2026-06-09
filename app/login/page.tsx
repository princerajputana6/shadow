'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setBusy(false)
    if (res?.error) setErr('Invalid email or password')
    // Send them to `/` — server-side it routes admins to /admin and customers
    // to /dashboard based on the User doc's isPlatformAdmin flag.
    else window.location.href = '/'
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8">
        <header>
          <h1 className="text-2xl font-semibold">Shadow</h1>
          <p className="text-sm text-muted">Sign in to your control room.</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email" required placeholder="Email"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password" required placeholder="Password"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-surface px-2 text-muted">or</span></div>
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm hover:bg-border/30"
        >
          Continue with Google (connects Gmail + Calendar)
        </button>
      </div>
    </main>
  )
}
