import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'

export default async function Home() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const user = await User.findById(session.user.id).select('isPlatformAdmin').lean()
  // Stale JWT — the user is gone. Clear cookies, then /login.
  if (!user) redirect('/api/auth/clear')
  redirect(user.isPlatformAdmin ? '/admin' : '/dashboard')
}
