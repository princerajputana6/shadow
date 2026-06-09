'use client'

import { signIn } from 'next-auth/react'

export function ReconnectGoogleButton() {
  return (
    <button
      onClick={() => signIn('google', { callbackUrl: '/settings' })}
      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black"
    >
      Re-connect Google
    </button>
  )
}
