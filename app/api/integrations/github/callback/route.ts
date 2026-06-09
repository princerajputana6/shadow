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
  const expectedState = req.headers.get('cookie')?.match(/gh_oauth_state=([^;]+)/)?.[1]
  if (!code) return back(req, 'no_code')
  if (!state || state !== expectedState) return back(req, 'bad_state')

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) return back(req, 'not_configured')

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/integrations/github/callback`
    })
  })
  const tokenJson = await tokenRes.json().catch(() => null) as {
    access_token?: string; scope?: string; error?: string
  } | null
  if (!tokenJson?.access_token) {
    console.error('[github oauth] exchange failed', tokenJson)
    return back(req, tokenJson?.error || 'exchange_failed')
  }

  // Fetch user login so we can show it on /settings
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  const ghUser = await userRes.json().catch(() => null) as { login?: string } | null

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return back(req, 'no_user')
  user.githubTokens = {
    accessToken: tokenJson.access_token,
    scope: tokenJson.scope,
    login: ghUser?.login,
    connectedAt: new Date()
  }
  await user.save()

  const redirect = NextResponse.redirect(new URL('/settings?github=connected', req.url))
  redirect.cookies.delete('gh_oauth_state')
  return redirect
}

function back(req: Request, err: string) {
  return NextResponse.redirect(new URL(`/settings?github_error=${encodeURIComponent(err)}`, req.url))
}
