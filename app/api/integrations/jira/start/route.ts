import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Jira (Atlassian) OAuth 2.0 (3LO).
// Create an app at https://developer.atlassian.com/console/myapps/
// Add OAuth 2.0 (3LO) Authorization callback URL: <APP>/api/integrations/jira/callback
// Required scopes (granular): read:jira-work, write:jira-work, read:me, offline_access
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url))
  const clientId = process.env.JIRA_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/integrations?jira_error=not_configured', req.url))

  const state = crypto.randomBytes(24).toString('hex')
  const url = new URL('https://auth.atlassian.com/authorize')
  url.searchParams.set('audience', 'api.atlassian.com')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'read:jira-work write:jira-work read:me offline_access')
  url.searchParams.set('redirect_uri', `${new URL(req.url).origin}/api/integrations/jira/callback`)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('prompt', 'consent')

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('jira_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600
  })
  return res
}
