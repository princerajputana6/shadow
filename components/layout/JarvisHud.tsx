'use client'

import { useEffect, useState } from 'react'

// Lightweight Jarvis-style HUD overlay used by the admin route group.
// Layers (z-order, bottom to top):
//   1. Animated grid backdrop (already on SpaceBackground)
//   2. Scanlines (CSS gradient + animation)
//   3. Corner brackets in each corner of the viewport
//   4. Live clock + system tag in a fixed corner
//   5. Content (children)
// Everything is pointer-events-none so it never blocks clicks.

export function JarvisHud({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {/* Scanline overlay */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[5]"
           style={{
             backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(56,189,248,0.02) 3px, rgba(56,189,248,0.02) 3px)'
           }} />
      {/* Sweeping scanline */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[6] h-12 opacity-[0.07] jarvis-sweep"
           style={{
             background: 'linear-gradient(to bottom, transparent, rgba(251,146,60,0.7), transparent)'
           }} />
      {/* Corner brackets */}
      <CornerBrackets />
      {/* HUD readout — fixed bottom-left */}
      <HudReadout />
      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx global>{`
        @keyframes jarvis-sweep {
          0% { transform: translateY(-100px) }
          100% { transform: translateY(100vh) }
        }
        .jarvis-sweep { animation: jarvis-sweep 9s linear infinite }
        @keyframes jarvis-bracket-pulse {
          0%, 100% { opacity: 0.4 }
          50% { opacity: 0.8 }
        }
        .jarvis-bracket { animation: jarvis-bracket-pulse 4s ease-in-out infinite }
        @keyframes jarvis-grid-shift {
          0% { background-position: 0 0 }
          100% { background-position: 64px 64px }
        }
      `}</style>
    </div>
  )
}

function CornerBrackets() {
  const arms = [
    { pos: 'top-3 left-3', rot: 0 },
    { pos: 'top-3 right-3', rot: 90 },
    { pos: 'bottom-3 right-3', rot: 180 },
    { pos: 'bottom-3 left-3', rot: 270 }
  ]
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[7]">
      {arms.map((a, i) => (
        <svg key={i} className={`jarvis-bracket absolute ${a.pos} h-10 w-10`}
             style={{ transform: `rotate(${a.rot}deg)` }}
             viewBox="0 0 40 40" fill="none">
          <path d="M 2 12 L 2 2 L 12 2" stroke="rgba(251,146,60,0.8)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 2 6 L 6 6" stroke="rgba(56,189,248,0.6)" strokeWidth="1" />
        </svg>
      ))}
    </div>
  )
}

function HudReadout() {
  const [time, setTime] = useState<string>('')
  useEffect(() => {
    const tick = () => {
      const d = new Date()
      const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      setTime(t)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div aria-hidden className="pointer-events-none fixed bottom-16 left-6 z-[7] text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/40 space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-amber-400/70 animate-pulse" />
        <span>SYS: AGENTOS-HQ // PLATFORM</span>
      </div>
      <div>{time}</div>
      <div className="text-cyan-300/40">LINK: STABLE · ENCRYPT: ON</div>
    </div>
  )
}
