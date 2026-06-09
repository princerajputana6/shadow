'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

export function Counter({ to, prefix = '', suffix = '', durationMs = 1400 }: {
  to: number; prefix?: string; suffix?: string; durationMs?: number
}) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.floor(to * eased))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, durationMs])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{val.toLocaleString('en-IN')}{suffix}
    </span>
  )
}
