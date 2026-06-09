import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import Link from 'next/link'
import { ReconnectGoogleButton } from './_components/ReconnectGoogleButton'
import { GithubConnection } from './_components/GithubConnection'

export const dynamic = 'force-dynamic'

async function checkRunner(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const url = process.env.AGENT_RUNNER_URL
  if (!url) return { ok: false, error: 'AGENT_RUNNER_URL not set' }
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
    return { ok: r.ok, url }
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : String(e) }
  }
}

const REQUIRED_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar'
]

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const user = await User.findById(session.user.id).lean()
  const runner = await checkRunner()

  const tokens = user?.googleTokens
  const scopes = (tokens?.scope || '').split(/\s+/).filter(Boolean)
  const missingScopes = REQUIRED_GOOGLE_SCOPES.filter(s => !scopes.includes(s))

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/dashboard" className="text-xs text-muted hover:text-text">← Dashboard</Link>
      </header>

      <Section title="Account">
        <Row label="Name" value={user?.name || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <Row label="Plan" value={user?.plan || '—'} />
        <Row label="Mongo userId" value={String(user?._id)} mono />
      </Section>

      <Section title="Google connection">
        <Row label="Connected" value={tokens?.refreshToken ? 'Yes' : 'No'} good={!!tokens?.refreshToken} bad={!tokens?.refreshToken} />
        <Row label="Refresh token" value={tokens?.refreshToken ? 'Stored (encrypted)' : 'Missing — re-connect'} good={!!tokens?.refreshToken} bad={!tokens?.refreshToken} />
        <div className="mt-2">
          <p className="text-xs text-muted mb-1">Granted scopes</p>
          <ul className="text-xs space-y-0.5">
            {REQUIRED_GOOGLE_SCOPES.map(s => (
              <li key={s} className={scopes.includes(s) ? 'text-emerald-400' : 'text-red-400'}>
                {scopes.includes(s) ? '✓' : '✗'} {s.replace('https://www.googleapis.com/auth/', '')}
              </li>
            ))}
          </ul>
          {missingScopes.length > 0 && (
            <p className="mt-2 text-xs text-amber-400">
              {missingScopes.length} scope{missingScopes.length === 1 ? '' : 's'} missing — reconnect Google to grant.
            </p>
          )}
        </div>
        <div className="mt-3">
          <ReconnectGoogleButton />
        </div>
      </Section>

      <Section title="GitHub connection">
        <GithubConnection
          connected={!!user?.githubTokens?.accessToken}
          login={user?.githubTokens?.login}
          connectedAt={user?.githubTokens?.connectedAt?.toString()}
          scope={user?.githubTokens?.scope}
        />
      </Section>

      <Section title="API keys (Next.js process)">
        <KeyRow label="Anthropic (Claude)" set={!!process.env.ANTHROPIC_API_KEY} required />
        <KeyRow label="Tavily Search" set={!!process.env.TAVILY_API_KEY} required={false}
                hint="Required for Lead Discovery agent" />
        <KeyRow label="Hunter.io" set={!!process.env.HUNTER_API_KEY} required={false}
                hint="Optional — auto-finds emails for discovered prospects" />
        <KeyRow label="GitHub OAuth (client id)" set={!!process.env.GITHUB_CLIENT_ID} required={false}
                hint="Required for the Developer agent's GitHub access" />
        <KeyRow label="Token encryption key" set={!!process.env.TOKEN_ENC_KEY} required />
        <p className="mt-3 text-[11px] text-muted">
          Keys must be added to <code>.env.local</code> (Next.js) and mirrored in <code>runner/.env</code> for the runner to use them.
          Both servers need a restart after env changes.
        </p>
      </Section>

      <Section title="Agent runner">
        <Row label="URL" value={runner.url || '(not set)'} mono />
        <Row label="Reachable" value={runner.ok ? 'Yes' : `No${runner.error ? ` — ${runner.error}` : ''}`} good={runner.ok} bad={!runner.ok} />
        <p className="mt-3 text-[11px] text-muted">
          The runner handles long-running agent jobs (sales outreach, discovery, enrichment). It's a separate Node.js process on port 3001 locally, or a Railway deploy in production.
        </p>
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </section>
  )
}

function Row({ label, value, mono, good, bad }: { label: string; value: string; mono?: boolean; good?: boolean; bad?: boolean }) {
  const color = good ? 'text-emerald-400' : bad ? 'text-red-400' : 'text-text'
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`${mono ? 'font-mono text-xs' : ''} ${color} text-right break-all`}>{value}</dd>
    </div>
  )
}

function KeyRow({ label, set, required, hint }: { label: string; set: boolean; required: boolean; hint?: string }) {
  const status = set ? '✓ Set' : required ? '✗ Required, not set' : '— Not set'
  return (
    <div>
      <Row label={label} value={status} good={set} bad={!set && required} />
      {hint && <p className="text-[11px] text-muted -mt-1 mb-1">{hint}</p>}
    </div>
  )
}
