import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Google reuses the NextAuth flow — kick the user through the Google sign-in
// which both authenticates them and persists the OAuth tokens.
export async function GET(req: Request) {
  const url = new URL('/api/auth/signin/google?callbackUrl=/integrations', req.url)
  return NextResponse.redirect(url)
}
