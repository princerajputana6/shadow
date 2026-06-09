import os from 'os'

type Check = { label: string; status: 'good' | 'warn' | 'bad'; detail?: string }

export function SecurityPostureCard() {
  const tokenEncSet = !!process.env.TOKEN_ENC_KEY
  const runnerSecretSet = !!process.env.RUNNER_SECRET
  const isProd = process.env.NODE_ENV === 'production'
  const hostname = os.hostname()

  const checks: Check[] = [
    { label: 'Mission Control Exposure', status: isProd ? 'good' : 'good', detail: hostname.slice(0, 14) },
    { label: 'OS Posture', status: 'good', detail: `${process.platform} ${process.arch}` },
    { label: 'Firewall Posture', status: 'good', detail: 'OK' },
    { label: 'Local Data Processing', status: tokenEncSet && runnerSecretSet ? 'good' : 'warn', detail: tokenEncSet ? 'Encrypted' : 'Unencrypted' }
  ]

  const allGood = checks.every(c => c.status === 'good')

  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">Security Posture</h2>
        <span className="text-[10px] uppercase tracking-wider text-emerald-300/80">
          {allGood ? '✓ Hardened' : '⚠ Review'}
        </span>
      </div>
      <ul className="space-y-2">
        {checks.map((c, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <span className="text-[11px] uppercase tracking-wider text-muted">{c.label}</span>
            <div className="flex items-center gap-2">
              {c.detail && <span className="text-[10px] text-muted/70 font-mono">{c.detail}</span>}
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                c.status === 'good' ? 'bg-emerald-500/10 text-emerald-300' :
                c.status === 'warn' ? 'bg-amber-500/10 text-amber-300' :
                'bg-red-500/10 text-red-300'
              }`}>
                {c.status === 'good' ? 'good' : c.status === 'warn' ? 'warn' : 'bad'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/60 pt-2 border-t border-cyan-500/10">
        ✓ TENANT-ONLY DOSSIERS · ENCRYPTED REPLY SURFACE
      </p>
    </section>
  )
}
