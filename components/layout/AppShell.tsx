import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { SpaceBackground } from './SpaceBackground'
import { PageFadeIn } from './PageFadeIn'
import { ShadowFloater } from './ShadowFloater'
import type { AgentStatusRow } from '@/lib/agentRoster'

type Props = {
  variant: 'member' | 'admin'
  userName?: string
  userEmail?: string
  orgName?: string
  isPlatformAdmin?: boolean
  roster?: AgentStatusRow[]
  children: React.ReactNode
}

export function AppShell({ variant, userName, userEmail, orgName, isPlatformAdmin, roster, children }: Props) {
  return (
    <div className="relative flex min-h-screen text-text">
      <SpaceBackground />
      <div className="relative z-10 flex min-h-screen w-full">
        <Sidebar variant={variant} roster={roster} isPlatformAdmin={isPlatformAdmin} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            variant={variant}
            userName={userName}
            userEmail={userEmail}
            orgName={orgName}
            isPlatformAdmin={isPlatformAdmin}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl w-full p-6">
              <PageFadeIn>{children}</PageFadeIn>
            </div>
          </main>
        </div>
      </div>
      {variant === 'member' && <ShadowFloater userName={userName} />}
    </div>
  )
}
