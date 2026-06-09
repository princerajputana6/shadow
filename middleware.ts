import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config'

// Edge-safe NextAuth instance — no Mongoose imports, no Node-only APIs.
// The `authorized` callback in auth.config handles redirect logic.
export const { auth: middleware } = NextAuth(authConfig)

export default middleware((_req) => {
  // authorized() in auth.config.ts does the gatekeeping
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
}
