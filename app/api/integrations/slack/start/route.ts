import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Slack OAuth 2.0.
// Create an app at https://api.slack.com/apps and add bot scopes:
//   chat:write, channels:read, channels:join
// Redirect URL: <APP>/api/integrations/slack/callback
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url))
  const clientId = process.env.SLACK_CLIENT_ID
  if (!clientId) return NextResponse.redirect(new URL('/integrations?slack_error=not_configured', req.url))

  const state = crypto.randomBytes(24).toString('hex')
  const url = new URL('https://slack.com/oauth/v2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'chat:write,channels:read,channels:join')
  url.searchParams.set('redirect_uri', `${new URL(req.url).origin}/api/integrations/slack/callback`)
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('slack_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 600
  })
  return res
}
