import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Bitbucket OAuth 2.0. Create a consumer at:
//   Workspace settings → OAuth consumers
// Callback URL: <APP>/api/integrations/bitbucket/callback
// Permissions: Account: Read; Repositories: Read+Write; Pull requests: Read+Write
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url))
  const clientId = process.env.BITBUCKET_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/integrations?bitbucket_error=not_configured', req.url))

  const state = crypto.randomBytes(24).toString('hex')
  const url = new URL('https://bitbucket.org/site/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('bb_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600
  })
  return res
}
