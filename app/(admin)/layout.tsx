import { AppShell } from '@/components/layout/AppShell'
import { requirePlatformAdmin } from '@/lib/access'
import { JarvisHud } from '@/components/layout/JarvisHud'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin()
  return (
    <AppShell
      variant="admin"
      userName={user.name}
      userEmail={user.email}
      isPlatformAdmin={true}
    >
      <JarvisHud>{children}</JarvisHud>
    </AppShell>
  )
}
