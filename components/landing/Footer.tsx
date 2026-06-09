export function Footer() {
  return (
    <footer className="relative border-t border-cyan-500/10 py-12 px-6">
      <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-4 gap-8 text-sm">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold">A</div>
            <div className="leading-tight">
              <div className="font-semibold">Shadow</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">by Biztreck</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted max-w-md leading-relaxed">
            Six specialist agents that run your sales, growth, content, and engineering operations.
            India + UAE, expanding to SEA in 2026.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70 mb-3">Product</p>
          <ul className="space-y-2 text-muted">
            <li><a href="#agents" className="hover:text-text">Agents</a></li>
            <li><a href="#pricing" className="hover:text-text">Pricing</a></li>
            <li><a href="#topup" className="hover:text-text">Top-ups</a></li>
            <li><a href="/login" className="hover:text-text">Sign in</a></li>
          </ul>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70 mb-3">Company</p>
          <ul className="space-y-2 text-muted">
            <li><a href="https://biztreck.world" className="hover:text-text">Biztreck</a></li>
            <li><a href="#signup" className="hover:text-text">Contact</a></li>
            <li><a href="mailto:connect@biztreck.world" className="hover:text-text">Email</a></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-6xl mt-10 pt-6 border-t border-cyan-500/5 text-[10px] uppercase tracking-[0.18em] text-muted/50 flex flex-wrap justify-between gap-2">
        <span>© 2026 Biztreck. All systems operational.</span>
        <span>Built in India · v0.1.0</span>
      </div>
    </footer>
  )
}
