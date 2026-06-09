import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import authConfig from '@/lib/auth.config'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'

declare module 'next-auth' {
  interface Session {
    user: { id: string; plan?: string } & DefaultSession['user']
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        await connectDB()
        const u = await User.findOne({ email: String(creds.email).toLowerCase() })
        if (!u?.passwordHash) return null
        const ok = await bcrypt.compare(String(creds.password), u.passwordHash)
        if (!ok) return null
        return { id: String(u._id), email: u.email, name: u.name ?? '', plan: u.plan }
      }
    })
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true
      if (!user?.email) {
        console.error('[auth.signIn] Google account has no email — denying')
        return false
      }
      try {
        await connectDB()
        const existing = await User.findOne({ email: user.email.toLowerCase() })
        const tokens = {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiryDate: account.expires_at ? account.expires_at * 1000 : undefined,
          scope: account.scope
        }
        if (existing) {
          existing.googleTokens = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || existing.googleTokens?.refreshToken,
            expiryDate: tokens.expiryDate,
            scope: tokens.scope
          }
          await existing.save()
        } else {
          await User.create({
            email: user.email.toLowerCase(),
            name: user.name,
            plan: 'owner',
            googleTokens: tokens
          })
        }
        return true
      } catch (e) {
        // Surface the real cause in dev logs instead of silently denying.
        console.error('[auth.signIn] Failed to persist Google user — denying.', e)
        return false
      }
    },
    async jwt({ token, user, account }) {
      // Credentials sign-in: user.id is already the Mongo _id (set in authorize)
      if (user && account?.provider === 'credentials') {
        token.uid = (user as { id: string }).id
        token.plan = (user as { plan?: string }).plan
        return token
      }
      // Google sign-in OR subsequent refresh: resolve to the Mongo _id by email
      // (Google's user.id is its `sub`, which is NOT a Mongo ObjectId.)
      const email = (user?.email || token.email) as string | undefined
      const needsResolve = !token.uid || !/^[a-f0-9]{24}$/i.test(String(token.uid))
      if (email && needsResolve) {
        await connectDB()
        const u = await User.findOne({ email: email.toLowerCase() })
        if (u) {
          token.uid = String(u._id)
          token.plan = u.plan
        } else {
          // No matching User doc — clear bad uid so the session callback
          // refuses to populate session.user.id and we redirect to /login.
          delete token.uid
          delete token.plan
        }
      }
      return token
    },
    async session({ session, token }) {
      // Match the Edge-safe callback exactly. token.uid is our preferred field
      // (set by jwt callback after DB resolve); token.sub is NextAuth's default
      // for Credentials (already a valid Mongo _id). Either is acceptable.
      const id = (token?.uid ?? token?.sub) as string | undefined
      if (typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)) {
        session.user.id = id
      }
      if (token?.plan) session.user.plan = String(token.plan)
      return session
    }
  }
})
