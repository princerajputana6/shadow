import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { NextResponse } from 'next/server'

// Edge-safe config: NO Mongoose, NO Node-only modules. Used by middleware
// (which runs on the Edge runtime) and extended by lib/auth.ts for full
// callbacks that need DB access.

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar'
].join(' ')

export default {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { scope: GOOGLE_SCOPES, access_type: 'offline', prompt: 'consent' }
      }
    })
  ],
  callbacks: {
    // Edge-safe session shaper. Without this, middleware sees session.user.id
    // as undefined because the DB-backed session callback in lib/auth.ts does
    // not run in the Edge runtime.
    session({ session, token }) {
      const id = (token?.uid ?? token?.sub) as string | undefined
      if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) {
        session.user.id = id
      }
      if (token?.plan) session.user.plan = String(token.plan)
      return session
    },
    authorized({ auth, request }) {
      // A valid session requires a Mongo ObjectId on user.id. Anything else
      // (broken JWT, stale cookie from before user re-seed) is treated as
      // unauthenticated so the user lands on /login and can sign in fresh.
      const id = auth?.user?.id
      const isAuthed = typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)
      const path = request.nextUrl.pathname
      // Routes anyone can hit, signed in or not. The marketing site (/) and
      // its API endpoint (/api/signup) live here.
      const isPublic = path === '/' ||
                       path === '/login' ||
                       path.startsWith('/api/auth') ||
                       path === '/api/signup'

      if (!isAuthed && !isPublic) {
        // If there's a stale auth cookie, route through /api/auth/clear so the
        // cookies get wiped on a 200 HTML response (Safari ignores Set-Cookie
        // on 302 redirects). Otherwise just send them to /login.
        if (auth) {
          return NextResponse.redirect(new URL('/api/auth/clear', request.nextUrl))
        }
        return NextResponse.redirect(new URL('/login', request.nextUrl))
      }
      if (isAuthed && path === '/login') {
        return NextResponse.redirect(new URL('/', request.nextUrl))  // / routes by admin/member
      }
      return true
    }
  }
} satisfies NextAuthConfig
