import { AppShell } from '@/components/layout/AppShell'
import { getCurrentUser, getCurrentOrg } from '@/lib/access'
import { getRosterWithStatus } from '@/lib/agentRoster'
import { redirect } from 'next/navigation'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const userId = String(user._id)

  const [current, roster] = await Promise.all([
    getCurrentOrg(userId),
    getRosterWithStatus(userId)
  ])

  // Admin with no org at all → send to /admin (their default mode).
  // Admin WITH an org can use member views freely (via the Switch Mode button).
  if (user.isPlatformAdmin && !current) {
    redirect('/admin')
  }

  // A non-admin without an org is in limbo — clear cookies and re-login.
  if (!user.isPlatformAdmin && !current) {
    redirect('/api/auth/clear')
  }

  return (
    <AppShell
      variant="member"
      userName={user.name}
      userEmail={user.email}
      orgName={current?.org?.name}
      isPlatformAdmin={!!user.isPlatformAdmin}
      roster={roster}
    >
      {children}
    </AppShell>
  )
}
