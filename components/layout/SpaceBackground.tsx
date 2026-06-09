'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'
import type * as THREE from 'three'

function DriftingStars() {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.01
    ref.current.rotation.x = Math.sin(t * 0.02) * 0.05
  })
  return (
    <group ref={ref}>
      <Stars radius={120} depth={60} count={3500} factor={4} saturation={0} fade speed={0.5} />
    </group>
  )
}

function Nebula() {
  // A faint distant glow — uses simple sphere with emissive material.
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.position.x = Math.sin(t * 0.05) * 8
    ref.current.position.y = Math.cos(t * 0.07) * 4
  })
  return (
    <mesh ref={ref} position={[0, 0, -25]}>
      <sphereGeometry args={[18, 32, 32]} />
      <meshBasicMaterial color="#fb923c" transparent opacity={0.04} />
    </mesh>
  )
}

export function SpaceBackground() {
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setMounted(true)
    // Honour reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setEnabled(!mq.matches)
    const handler = (e: MediaQueryListEvent) => setEnabled(!e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (!mounted) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Static CSS layer — nebula glow */}
      <div className="absolute inset-0"
           style={{
             background:
               'radial-gradient(ellipse at 30% 20%, rgba(251,146,60,0.08) 0%, transparent 50%), ' +
               'radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 50%), ' +
               'radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 70%)'
           }} />
      {/* Subtle grid overlay for sci-fi feel */}
      <div className="absolute inset-0 opacity-[0.05]"
           style={{
             backgroundImage:
               'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), ' +
               'linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
             backgroundSize: '64px 64px',
             maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
           }} />
      {/* Three.js star canvas */}
      {enabled && (
        <Canvas
          camera={{ position: [0, 0, 1], fov: 60 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.3} />
          <DriftingStars />
          <Nebula />
        </Canvas>
      )}
      {/* Vignette to soften edges */}
      <div className="absolute inset-0"
           style={{
             background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,10,11,0.4) 80%, rgba(10,10,11,0.9) 100%)'
           }} />
    </div>
  )
}
