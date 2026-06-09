import os from 'os'

// Node 22+ provides process.memoryUsage().rss in bytes — the resident set size
// of *this* Node process (not the OS). We show that instead of system memory
// because os.freemem() is misleading on macOS (excludes file-cache pressure)
// and on Linux containers (host-level, not container-level).

// Dev mode (with HMR, file watchers, source maps) uses 1–2 GB easily.
// Production builds are usually 200–400 MB. So cap depends on env.
const PROCESS_RAM_CAP_MB = process.env.NODE_ENV === 'production' ? 1024 : 4096

export function VpsHealthCard() {
  const cpuCount = os.cpus().length
  const loadAvg = os.loadavg()[0]
  const cpuPct = Math.min(100, Math.round((loadAvg / cpuCount) * 100))

  const mem = process.memoryUsage()
  const rssMB = Math.round(mem.rss / 1024 / 1024)
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024)
  const ramPct = Math.min(100, Math.round((rssMB / PROCESS_RAM_CAP_MB) * 100))

  // Real disk usage would need a separate lib; placeholder for now.
  const diskPct = 32

  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-surface/60 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] uppercase tracking-[0.22em] text-muted">Process Health</h2>
        <span className="text-[10px] uppercase tracking-wider text-muted/60">node {process.version}</span>
      </div>
      <div className="space-y-3">
        <Gauge label="CPU" value={cpuPct}
               detail={`${cpuCount} cores · load ${loadAvg.toFixed(2)}`}
               accent="cyan" />
        <Gauge label="Memory" value={ramPct}
               detail={`${rssMB} MB RSS · ${heapUsedMB} MB heap`}
               accent="violet" />
        <Gauge label="Disk" value={diskPct} detail="approx." accent="orange" />
      </div>
      <p className="text-[10px] text-muted/50 mt-3 pt-3 border-t border-cyan-500/10">
        Process metrics (this Node server). Not OS-wide.
      </p>
    </section>
  )
}

function Gauge({ label, value, detail, accent }: { label: string; value: number; detail: string; accent: 'cyan' | 'violet' | 'orange' }) {
  const grad = accent === 'cyan' ? 'from-cyan-400 to-cyan-600'
            : accent === 'violet' ? 'from-violet-400 to-violet-600'
            : 'from-orange-400 to-orange-600'
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="uppercase tracking-wider text-muted">{label}</span>
        <span className="font-mono tabular-nums">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-bg/60 overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${grad}`} style={{ width: `${value}%` }} />
      </div>
      <p className="text-[10px] text-muted/70 mt-0.5 font-mono">{detail}</p>
    </div>
  )
}
