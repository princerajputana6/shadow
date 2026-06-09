'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Web Speech API types (not in lib.dom.d.ts on all TS versions)
type SR = {
  start: () => void
  stop: () => void
  abort: () => void
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: { transcript: string; isFinal?: boolean }[][] & { length: number } }) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
}

const WAKE_PHRASES = ['hey shadow', 'shadow', 'okay shadow', 'hi shadow']

export function ShadowAssistant() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [listening, setListening] = useState(false)
  const [armed, setArmed] = useState(false) // wake word detected, listening for command
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const recRef = useRef<SR | null>(null)
  const armedRef = useRef(false)
  const armedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    setSupported(!!Ctor)
  }, [])

  function start() {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1] as unknown as { 0: { transcript: string }; isFinal?: boolean }
      const text = last[0].transcript.trim().toLowerCase()
      setTranscript(text)
      if (!armedRef.current) {
        if (WAKE_PHRASES.some((w) => text.includes(w))) {
          armedRef.current = true
          setArmed(true)
          // Auto-disarm after 8s of no command
          if (armedTimeoutRef.current) clearTimeout(armedTimeoutRef.current)
          armedTimeoutRef.current = setTimeout(() => { armedRef.current = false; setArmed(false) }, 8000)
        }
        return
      }
      // Armed: collect the command after the wake word
      if (last.isFinal) {
        const cleaned = stripWake(text)
        if (cleaned.length < 2) return
        armedRef.current = false
        setArmed(false)
        if (armedTimeoutRef.current) clearTimeout(armedTimeoutRef.current)
        askShadow(cleaned)
      }
    }
    rec.onerror = (err) => console.warn('[shadow] recognition error', err)
    rec.onend = () => {
      // Auto-restart unless user toggled off
      if (recRef.current === rec) {
        try { rec.start() } catch {}
      }
    }
    recRef.current = rec
    try { rec.start(); setListening(true) } catch (e) { console.warn(e) }
  }

  function stop() {
    const rec = recRef.current
    recRef.current = null
    rec?.abort()
    setListening(false); setArmed(false); armedRef.current = false
  }

  async function askShadow(query: string) {
    setBusy(true); setResponse(null)
    try {
      const res = await fetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      const answer = data?.answer || 'I could not pull that up right now.'
      setResponse(answer)
      speak(answer)
    } catch {
      setResponse('Something went wrong reaching Shadow.')
    } finally {
      setBusy(false)
    }
  }

  function speak(text: string) {
    if (typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0; u.lang = 'en-IN'
    window.speechSynthesis.speak(u)
  }

  function manualAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const input = form.elements.namedItem('q') as HTMLInputElement
    const q = input.value.trim()
    if (!q) return
    askShadow(q)
    input.value = ''
  }

  if (supported === null) return null

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Shadow assistant</h2>
          <p className="text-xs text-muted">
            Say <span className="text-text">"Hey Shadow, tell me today's update"</span> — or type below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!supported && <span className="text-xs text-muted">Voice unsupported in this browser</span>}
          {supported && (
            <button
              onClick={listening ? stop : start}
              className={`rounded-full px-3 py-1.5 text-xs font-medium border transition
                ${listening ? 'bg-accent text-black border-accent' : 'bg-bg border-border hover:bg-border/30'}`}
            >
              {listening ? (armed ? '● Listening for command…' : '● Listening for wake word') : '○ Enable voice'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(transcript || response || busy) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {transcript && listening && (
              <p className="text-xs text-muted">You: <span className="text-text">{transcript}</span></p>
            )}
            {busy && <p className="text-xs text-muted">Shadow is thinking…</p>}
            {response && (
              <div className="rounded-lg border border-border bg-bg p-3 text-sm">
                <span className="text-xs text-muted">Shadow:</span>
                <p className="mt-1">{response}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={manualAsk} className="flex gap-2">
        <input
          name="q" type="text" placeholder="Type a question — e.g. how many leads today?"
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black">Ask</button>
      </form>
    </section>
  )
}

function stripWake(s: string) {
  let out = s
  for (const w of WAKE_PHRASES) {
    const idx = out.lastIndexOf(w)
    if (idx >= 0) out = out.slice(idx + w.length)
  }
  return out.replace(/^[,.\s]+/, '').trim()
}
