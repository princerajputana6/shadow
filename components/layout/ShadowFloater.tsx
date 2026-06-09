'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type SR = {
  start: () => void
  stop: () => void
  abort: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: { transcript: string; isFinal?: boolean }[][] & { length: number } }) => void) | null
  onerror: ((e: { error?: string; message?: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

const STORAGE_KEY = 'shadow.conv.autoStart'
const LANG_KEY = 'shadow.lang'
const MIN_UTTERANCE_CHARS = 2
const MAX_CONSECUTIVE_FAILURES = 3
const RESTART_DEBOUNCE_MS = 800
const POST_TTS_COOLDOWN_MS = 1500     // wait for audio buffer to clear after Shadow speaks
const ECHO_SIMILARITY_THRESHOLD = 0.6  // ignore transcripts that overlap >=60% with Shadow's last reply
const DUP_TRANSCRIPT_WINDOW_MS = 3000

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'हिंदी · Hindi' },
  { code: 'bn-IN', label: 'বাংলা · Bengali' },
  { code: 'ta-IN', label: 'தமிழ் · Tamil' },
  { code: 'te-IN', label: 'తెలుగు · Telugu' },
  { code: 'mr-IN', label: 'मराठी · Marathi' },
  { code: 'gu-IN', label: 'ગુજરાતી · Gujarati' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ · Kannada' },
  { code: 'ml-IN', label: 'മലയാളം · Malayalam' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ · Punjabi' },
  { code: 'ur-IN', label: 'اردو · Urdu' },
  { code: 'or-IN', label: 'ଓଡ଼ିଆ · Odia' }
]

// Cheap token-overlap similarity (Jaccard on word sets, lowercased, ignoring short words).
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const tokens = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-zऀ-ॿঀ-৿஀-௿ఀ-౿ಀ-೿ഀ-ൿ઀-૿਀-੿\s]/g, ' ')
     .split(/\s+/).filter(t => t.length > 2)
  )
  const A = tokens(a), B = tokens(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / Math.min(A.size, B.size)
}

type BrowserCheck = { ok: true } | { ok: false; reason: 'unsupported' | 'brave' | 'unknown' }

async function checkBrowser(): Promise<BrowserCheck> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' }
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  if (!w.SpeechRecognition && !w.webkitSpeechRecognition) return { ok: false, reason: 'unsupported' }
  const nav = navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }
  if (nav.brave?.isBrave) {
    try { if (await nav.brave.isBrave()) return { ok: false, reason: 'brave' } } catch {}
  }
  return { ok: true }
}

type Status = 'off' | 'listening' | 'capturing' | 'thinking' | 'speaking' | 'error'

export function ShadowFloater({ userName }: { userName?: string }) {
  const [browserCheck, setBrowserCheck] = useState<BrowserCheck | null>(null)
  const [status, setStatus] = useState<Status>('off')
  const [conversing, setConversing] = useState(false)
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [, setLastResponse] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [history, setHistory] = useState<{ who: 'you' | 'shadow'; text: string }[]>([])

  const recRef = useRef<SR | null>(null)
  const conversingRef = useRef(false)
  const speakingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; ts: number }>({ text: '', ts: 0 })
  const lastShadowReplyRef = useRef<string>('')
  const failureCountRef = useRef(0)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const langRef = useRef<string>('en-IN')
  const [lang, setLang] = useState<string>('en-IN')

  // Restore language preference
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(LANG_KEY)
    if (saved) { setLang(saved); langRef.current = saved }
  }, [])

  function changeLanguage(code: string) {
    setLang(code); langRef.current = code
    localStorage.setItem(LANG_KEY, code)
    // Restart current recognition with new lang
    if (conversingRef.current) { stopRecognition(); scheduleNextTurn(200) }
  }

  useEffect(() => {
    let cancelled = false
    checkBrowser().then(check => {
      if (cancelled) return
      setBrowserCheck(check)
      if (!check.ok) return
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        setTimeout(() => startConversation(), 600)
      } else {
        const seen = localStorage.getItem('shadow.seenWelcomeV2') === '1'
        if (!seen) {
          setShowWelcome(true)
          localStorage.setItem('shadow.seenWelcomeV2', '1')
          setTimeout(() => setShowWelcome(false), 9000)
        }
      }
    })
    return () => { cancelled = true; stopRecognition() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildRec(): SR | null {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    return Ctor ? new Ctor() : null
  }

  // Single restart path — debounced. All restart triggers schedule here.
  const scheduleNextTurn = useCallback((delay = RESTART_DEBOUNCE_MS) => {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
    if (!conversingRef.current || speakingRef.current) return
    if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) return
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null
      beginListenTurn()
    }, delay)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start a fresh recognition session (used between turns)
  const beginListenTurn = useCallback(() => {
    if (!conversingRef.current) return
    if (speakingRef.current) return
    if (recRef.current) return  // already running
    if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) return

    const rec = buildRec()
    if (!rec) return
    rec.continuous = false
    rec.interimResults = true
    rec.lang = langRef.current || 'en-IN'
    let ended = false

    rec.onstart = () => {
      setStatus('listening')
      setTranscript('')
      setLastError(null)
    }
    rec.onresult = (e) => {
      const list = e.results as unknown as { length: number }
      const lastIdx = list.length - 1
      const last = (e.results as unknown as { 0: { transcript: string }; isFinal?: boolean }[])[lastIdx]
      const text = last[0].transcript.trim()
      setTranscript(text)
      if (text.length > 1) setStatus('capturing')
      if (last.isFinal && text.length >= MIN_UTTERANCE_CHARS) {
        // Guard 1: strict dup within 3s
        const now = Date.now()
        if (text.toLowerCase() === lastFinalRef.current.text.toLowerCase()
            && now - lastFinalRef.current.ts < DUP_TRANSCRIPT_WINDOW_MS) {
          ended = true
          if (recRef.current === rec) recRef.current = null
          try { rec.stop() } catch {}
          scheduleNextTurn()
          return
        }
        // Guard 2: echo of Shadow's last reply
        const sim = similarity(text, lastShadowReplyRef.current)
        if (sim >= ECHO_SIMILARITY_THRESHOLD) {
          console.log('[shadow] dropping echo of own reply (similarity', sim.toFixed(2), ')')
          ended = true
          if (recRef.current === rec) recRef.current = null
          try { rec.stop() } catch {}
          scheduleNextTurn()
          return
        }

        lastFinalRef.current = { text, ts: now }
        failureCountRef.current = 0
        ended = true
        if (recRef.current === rec) recRef.current = null
        try { rec.stop() } catch {}
        askShadow(text)
      }
    }
    rec.onerror = (err) => {
      const code = err?.error || 'unknown'
      ended = true
      if (recRef.current === rec) recRef.current = null

      // 'aborted' = something killed it (often our own .abort()). Don't count as failure.
      if (code === 'aborted') return

      if (code === 'no-speech') {
        // Silence is fine — just rotate the listener
        scheduleNextTurn(300)
        return
      }
      // Real error
      handleError(code)
    }
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null
      if (ended) return  // already handled by onresult/onerror
      // Ended without producing a final result or error — Brave kills sessions this way.
      // Count as a soft failure to avoid loops.
      failureCountRef.current++
      if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        handleError('repeated_aborts')
        return
      }
      scheduleNextTurn()
    }

    try {
      rec.start()
      recRef.current = rec
    } catch (e) {
      handleError((e as Error).message)
    }
  }, [scheduleNextTurn])

  const startConversation = useCallback(() => {
    setLastError(null)
    setTranscript('')
    setOpen(true)
    setConversing(true)
    conversingRef.current = true
    failureCountRef.current = 0
    localStorage.setItem(STORAGE_KEY, '1')
    scheduleNextTurn(100)
  }, [scheduleNextTurn])

  function endConversation() {
    setConversing(false)
    conversingRef.current = false
    localStorage.removeItem(STORAGE_KEY)
    stopRecognition()
    try { window.speechSynthesis.cancel() } catch {}
    speakingRef.current = false
    setStatus('off')
  }

  function stopRecognition() {
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
    const rec = recRef.current
    recRef.current = null
    try { rec?.abort() } catch {}
  }

  function handleError(code: string) {
    console.warn('[shadow] error:', code)
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      localStorage.removeItem(STORAGE_KEY)
      setLastError('Mic permission denied. Allow microphone for this site in browser settings and reload.')
      setConversing(false); conversingRef.current = false
    } else if (code === 'audio-capture') {
      setLastError('No microphone detected.')
      setConversing(false); conversingRef.current = false
    } else if (code === 'network') {
      setLastError('Speech recognition blocked or no internet. If you are on Brave, the privacy shield blocks Google Speech — disable Shields for this site or use Chrome.')
      setConversing(false); conversingRef.current = false
    } else if (code === 'repeated_aborts') {
      setLastError('Voice recognition keeps getting cancelled by the browser. Most common cause: Brave Shields. Disable Shields for localhost:3000, or open this app in Chrome.')
      setConversing(false); conversingRef.current = false
      localStorage.removeItem(STORAGE_KEY)
    } else {
      setLastError(`Speech error: ${code}. Try Chrome if it keeps failing.`)
    }
    setStatus('error')
    if (conversingRef.current) setTimeout(() => scheduleNextTurn(), 2500)
  }

  async function askShadow(query: string) {
    setStatus('thinking')
    setHistory(h => [...h, { who: 'you', text: query }])
    setLastResponse(null)
    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const answer = data?.answer || 'I could not pull that up.'
      setLastResponse(answer)
      lastShadowReplyRef.current = answer  // for echo detection
      setHistory(h => [...h, { who: 'shadow', text: answer }])
      speakAndResume(answer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setLastError(`Couldn't reach Shadow: ${msg}`)
      setStatus('error')
      setHistory(h => [...h, { who: 'shadow', text: `(error: ${msg})` }])
      if (conversingRef.current) setTimeout(beginListenTurn, 1500)
      else setStatus('off')
    }
  }

  function speakAndResume(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0
    u.lang = langRef.current || 'en-IN'
    // Try to pick a voice matching the chosen language
    const voices = window.speechSynthesis.getVoices()
    const matchExact = voices.find(v => v.lang === u.lang)
    const matchPrefix = voices.find(v => v.lang.startsWith(u.lang.split('-')[0]))
    if (matchExact) u.voice = matchExact
    else if (matchPrefix) u.voice = matchPrefix

    speakingRef.current = true
    u.onstart = () => setStatus('speaking')
    u.onend = () => {
      speakingRef.current = false
      if (conversingRef.current) {
        setStatus('listening')
        // Long cooldown so the mic buffer clears before we listen again — kills echo loops
        scheduleNextTurn(POST_TTS_COOLDOWN_MS)
      } else {
        setStatus('off')
      }
    }
    u.onerror = () => {
      speakingRef.current = false
      if (conversingRef.current) scheduleNextTurn(POST_TTS_COOLDOWN_MS)
    }
    window.speechSynthesis.speak(u)
  }

  function onOrbClick() {
    if (conversing) {
      if (status === 'speaking') {
        try { window.speechSynthesis.cancel() } catch {}
        speakingRef.current = false
        scheduleNextTurn(100)
        return
      }
      endConversation()
      return
    }
    failureCountRef.current = 0
    startConversation()
  }

  function onOrbContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setOpen(v => !v)
  }

  function manualAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('q') as HTMLInputElement
    const q = input.value.trim()
    if (!q) return
    if (!conversing) {
      setConversing(true); conversingRef.current = true
    }
    askShadow(q); input.value = ''
  }

  if (browserCheck === null) return null  // still detecting
  if (!browserCheck.ok) {
    const msg = browserCheck.reason === 'brave'
      ? 'Brave blocks Web Speech API — use Chrome, or click here to learn how to disable Shields.'
      : 'Voice not supported in this browser — use Chrome, Edge, or Safari.'
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <details className="group">
          <summary className="list-none cursor-pointer rounded-full bg-surface/95 border border-amber-500/30 px-3 py-2 text-xs text-amber-200 backdrop-blur shadow-lg flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Voice unavailable
          </summary>
          <div className="mt-2 w-72 rounded-xl border border-amber-500/30 bg-surface/95 backdrop-blur p-3 text-xs text-text shadow-xl">
            <p>{msg}</p>
            {browserCheck.reason === 'brave' && (
              <ol className="mt-2 list-decimal list-inside space-y-0.5 text-muted">
                <li>Click the Brave Shields icon in the address bar</li>
                <li>Toggle Shields <em>down</em> for localhost</li>
                <li>Reload the page</li>
              </ol>
            )}
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {/* Welcome bubble */}
      <AnimatePresence>
        {showWelcome && status === 'off' && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                      className="absolute bottom-20 right-0 w-80 rounded-xl border border-cyan-500/20 bg-surface/95 backdrop-blur p-4 shadow-2xl">
            <p className="text-sm font-medium">👋 Hey, {userName?.split(' ')[0] || 'there'}.</p>
            <p className="text-xs text-muted mt-1.5">
              Click the orb to start a conversation. No wake word needed — just talk and I'll talk back, like ChatGPT voice mode.
            </p>
            <button onClick={() => { setShowWelcome(false); startConversation() }}
                    className="mt-3 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black">
              Start talking
            </button>
            <button onClick={() => setShowWelcome(false)}
                    className="mt-2 w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted">
              Maybe later
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded panel — history view */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                      className="absolute bottom-20 right-0 w-[380px] max-h-[520px] rounded-2xl border border-cyan-500/20 bg-surface/95 backdrop-blur-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Shadow</span>
                <StatusPip status={status} />
              </div>
              <div className="flex items-center gap-2">
                <select value={lang} onChange={e => changeLanguage(e.target.value)}
                        className="text-[10px] rounded-md border border-border bg-bg px-1.5 py-0.5 text-text">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                {conversing && (
                  <button onClick={endConversation}
                          className="text-[10px] uppercase tracking-wider text-red-300 hover:text-red-200">
                    end
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-text">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm min-h-[180px]">
              {history.length === 0 && status === 'off' && (
                <p className="text-xs text-muted text-center py-8">
                  Click the orb below to start talking.
                </p>
              )}
              {history.map((m, i) => (
                <div key={i} className={`flex ${m.who === 'you' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.who === 'you'
                      ? 'bg-cyan-500/15 text-text border border-cyan-400/20'
                      : 'bg-bg/60 text-text border border-violet-400/20'
                  }`}>
                    <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                      {m.who === 'you' ? 'You' : 'Shadow'}
                    </p>
                    <p className="text-sm leading-snug whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              ))}
              {transcript && status === 'listening' && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-cyan-500/5 text-muted border border-dashed border-cyan-400/20">
                    <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">You (live)</p>
                    <p className="text-sm leading-snug italic">{transcript}…</p>
                  </div>
                </div>
              )}
              {transcript && status === 'capturing' && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-cyan-500/10 text-text border border-cyan-400/30">
                    <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">You</p>
                    <p className="text-sm leading-snug">{transcript}</p>
                  </div>
                </div>
              )}
              {status === 'thinking' && (
                <p className="text-xs text-violet-300 animate-pulse">Shadow is thinking…</p>
              )}
              {lastError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                  {lastError}
                </div>
              )}
            </div>

            <form onSubmit={manualAsk} className="px-4 py-3 border-t border-cyan-500/10 flex gap-2">
              <input name="q" type="text" placeholder="Type or just speak…"
                     className="flex-1 rounded-md border border-border bg-bg px-3 py-1.5 text-sm" />
              <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black">Send</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <ShadowOrb status={status} conversing={conversing}
                 onClick={onOrbClick} onContextMenu={onOrbContextMenu} />
    </div>
  )
}

function ShadowOrb({ status, conversing, onClick, onContextMenu }: {
  status: Status; conversing: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void
}) {
  const colors: Record<Status, string> = {
    off:       'from-zinc-600 to-zinc-900',
    listening: 'from-cyan-400 to-blue-700',
    capturing: 'from-cyan-300 to-cyan-700',
    thinking:  'from-violet-400 to-fuchsia-600',
    speaking:  'from-emerald-400 to-teal-600',
    error:     'from-red-400 to-red-700'
  }
  const labels: Record<Status, string> = {
    off: 'Click to talk to Shadow',
    listening: 'Listening… speak any time',
    capturing: 'Got it — finalising',
    thinking: 'Thinking…',
    speaking: 'Speaking — click to interrupt',
    error: 'Click to retry'
  }

  return (
    <div className="relative group">
      <button onClick={onClick} onContextMenu={onContextMenu}
              className={`relative h-16 w-16 rounded-full bg-gradient-to-br ${colors[status]} shadow-2xl shadow-black/50
                          flex items-center justify-center transition-transform active:scale-95`}>
        {status !== 'off' && status !== 'error' && (
          <span className={`absolute inset-0 rounded-full ${
            status === 'speaking'  ? 'animate-pulse bg-emerald-400/30' :
            status === 'thinking'  ? 'animate-pulse bg-violet-400/30' :
            status === 'capturing' ? 'animate-pulse bg-cyan-400/40' :
                                     'animate-pulse bg-cyan-400/25'
          }`} />
        )}
        <span className={`relative h-7 w-7 rounded-full bg-white/95 ${
          ['capturing', 'thinking', 'speaking'].includes(status) ? 'animate-pulse' : ''
        }`} />
        {conversing && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-bg" />
        )}
      </button>
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap
                      rounded-md bg-bg/95 backdrop-blur border border-border px-2.5 py-1 text-[11px]
                      opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {labels[status]}
        <span className="block text-[9px] text-muted/60">Right-click to open chat</span>
      </div>
    </div>
  )
}

function StatusPip({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    off: 'bg-zinc-500', listening: 'bg-cyan-400', capturing: 'bg-cyan-300',
    thinking: 'bg-violet-400', speaking: 'bg-emerald-400', error: 'bg-red-400'
  }
  const labels: Record<Status, string> = {
    off: 'idle', listening: 'listening', capturing: 'capturing',
    thinking: 'thinking', speaking: 'speaking', error: 'error'
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${colors[status]} ${status !== 'off' && status !== 'error' ? 'animate-pulse' : ''}`} />
      {labels[status]}
    </span>
  )
}
