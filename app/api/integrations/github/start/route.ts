import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Build a GitHub OAuth authorize URL with a CSRF-protected state cookie.
// Scope: `repo` for private repos + read user (needed to read login).
// Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url))

  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'GITHUB_CLIENT_ID not set' }, { status: 500 })

  const state = crypto.randomBytes(24).toString('hex')
  const redirectUri = `${new URL(req.url).origin}/api/integrations/github/callback`

  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'repo read:user')
  url.searchParams.set('state', state)
  url.searchParams.set('allow_signup', 'false')

  const res = NextResponse.redirect(url.toString())
  // CSRF token cookie — short-lived
  res.cookies.set('gh_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600
  })
  return res
}
