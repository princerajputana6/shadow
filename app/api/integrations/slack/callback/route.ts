import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', req.url))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = req.headers.get('cookie')?.match(/slack_oauth_state=([^;]+)/)?.[1]
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL('/integrations?slack_error=bad_state', req.url))
  }

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/integrations?slack_error=not_configured', req.url))
  }

  const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/integrations/slack/callback`
    }).toString()
  })
  const data = await tokenRes.json().catch(() => null) as {
    ok?: boolean; access_token?: string; team?: { id?: string; name?: string }; error?: string
  } | null
  if (!data?.ok || !data?.access_token) {
    return NextResponse.redirect(new URL(`/integrations?slack_error=${data?.error || 'exchange_failed'}`, req.url))
  }

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  user.slackTokens = {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    connectedAt: new Date()
  }
  await user.save()

  const redirect = NextResponse.redirect(new URL('/integrations?slack=connected', req.url))
  redirect.cookies.delete('slack_oauth_state')
  return redirect
}
