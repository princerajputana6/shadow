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
  const expected = req.headers.get('cookie')?.match(/jira_oauth_state=([^;]+)/)?.[1]
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL('/integrations?jira_error=bad_state', req.url))
  }

  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/integrations?jira_error=not_configured', req.url))
  }

  const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/integrations/jira/callback`
    })
  })
  const data = await tokenRes.json().catch(() => null) as {
    access_token?: string; refresh_token?: string; expires_in?: number; error?: string
  } | null
  if (!data?.access_token) {
    return NextResponse.redirect(new URL(`/integrations?jira_error=${data?.error || 'exchange_failed'}`, req.url))
  }

  // Find accessible resource (Jira Cloud site)
  const resRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/json' }
  })
  const resources = await resRes.json().catch(() => []) as { id: string; url: string }[]
  const primary = resources[0]

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  user.jiraTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    cloudId: primary?.id,
    siteUrl: primary?.url,
    expiryDate: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    connectedAt: new Date()
  }
  await user.save()

  const redirect = NextResponse.redirect(new URL('/integrations?jira=connected', req.url))
  redirect.cookies.delete('jira_oauth_state')
  return redirect
}
