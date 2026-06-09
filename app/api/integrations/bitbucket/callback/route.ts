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
  const expected = req.headers.get('cookie')?.match(/bb_oauth_state=([^;]+)/)?.[1]
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL('/integrations?bitbucket_error=bad_state', req.url))
  }

  const clientId = process.env.BITBUCKET_CLIENT_ID
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/integrations?bitbucket_error=not_configured', req.url))
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }).toString()
  })
  const data = await tokenRes.json().catch(() => null) as {
    access_token?: string; refresh_token?: string; expires_in?: number; error?: string
  } | null
  if (!data?.access_token) {
    return NextResponse.redirect(new URL(`/integrations?bitbucket_error=${data?.error || 'exchange_failed'}`, req.url))
  }

  // Fetch username
  const userRes = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: { Authorization: `Bearer ${data.access_token}` }
  })
  const bbUser = await userRes.json().catch(() => null) as { username?: string } | null

  await connectDB()
  const user = await User.findById(session.user.id)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))
  user.bitbucketTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    username: bbUser?.username,
    expiryDate: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    connectedAt: new Date()
  }
  await user.save()

  const redirect = NextResponse.redirect(new URL('/integrations?bitbucket=connected', req.url))
  redirect.cookies.delete('bb_oauth_state')
  return redirect
}
