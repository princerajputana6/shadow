import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import { LandingNav } from '@/components/landing/LandingNav'
import { Hero } from '@/components/landing/Hero'
import { AgentGrid } from '@/components/landing/AgentGrid'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Pricing } from '@/components/landing/Pricing'
import { TopUp } from '@/components/landing/TopUp'
import { RequestAccess } from '@/components/landing/RequestAccess'
import { Footer } from '@/components/landing/Footer'
import { SpaceBackground } from '@/components/layout/SpaceBackground'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await auth()
  if (session?.user?.id) {
    await connectDB()
    const user = await User.findById(session.user.id).select('isPlatformAdmin').lean()
    if (!user) redirect('/api/auth/clear')
    redirect(user.isPlatformAdmin ? '/admin' : '/dashboard')
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden text-text">
      <SpaceBackground />
      <LandingNav />
      <div className="relative z-10">
        <Hero />
        <div id="agents"><AgentGrid /></div>
        <div id="how"><HowItWorks /></div>
        <Pricing />
        <div id="topup"><TopUp /></div>
        <RequestAccess />
        <Footer />
      </div>
    </main>
  )
}
