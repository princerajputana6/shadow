'use client'

import { useState, useTransition } from 'react'
import { addBusinessFromUrl } from '../actions'

export function AddBusinessForm() {
  const [url, setUrl] = useState('')
  const [busy, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setOk(null)
    startTransition(async () => {
      try {
        const r = await addBusinessFromUrl(url)
        setOk(
          r.stub
            ? `Added "${r.name}". AI profiling was unavailable — please fill in the services and keywords manually.`
            : `Added "${r.name}". Profile extracted — review and tweak below.`
        )
        setUrl('')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5 space-y-3">
      <div>
        <h2 className="text-sm font-medium">Add a business</h2>
        <p className="text-xs text-muted">Paste a URL. Claude reads the homepage, extracts what you sell, and seeds buyer-intent search keywords.</p>
      </div>
      <div className="flex gap-2">
        <input
          type="url" required placeholder="https://www.biztreck.world/"
          value={url} onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        <button disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
          {busy ? 'Reading site…' : 'Add'}
        </button>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {ok && <p className="text-xs text-emerald-400">{ok}</p>}
    </form>
  )
}
