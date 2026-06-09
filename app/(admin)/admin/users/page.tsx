import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import Membership from '@/models/Membership'
import Organization from '@/models/Organization'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  await connectDB()
  const users = await User.find({}).sort({ createdAt: -1 }).limit(200).select('name email plan isPlatformAdmin createdAt').lean()
  const memberships = await Membership.find({ userId: { $in: users.map(u => u._id) } }).lean()
  const orgs = await Organization.find({ _id: { $in: memberships.map(m => m.organizationId) } }).lean()
  const orgMap = new Map(orgs.map(o => [String(o._id), o]))
  const userToOrgs = new Map<string, { name: string; role: string; id: string }[]>()
  for (const m of memberships) {
    const k = String(m.userId)
    const o = orgMap.get(String(m.organizationId))
    if (!o) continue
    const list = userToOrgs.get(k) || []
    list.push({ name: o.name, role: m.role, id: String(o._id) })
    userToOrgs.set(k, list)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted">Every user account across all companies. {users.length} shown.</p>
      </header>

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted bg-bg/50">
            <tr>
              <th className="px-5 py-2 font-medium">User</th>
              <th className="px-5 py-2 font-medium">Orgs</th>
              <th className="px-5 py-2 font-medium">Plan</th>
              <th className="px-5 py-2 font-medium">Admin</th>
              <th className="px-5 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const orgs = userToOrgs.get(String(u._id)) || []
              return (
                <tr key={String(u._id)} className="border-t border-border">
                  <td className="px-5 py-3">
                    <p className="font-medium">{u.name || '—'}</p>
                    <p className="text-[11px] text-muted">{u.email}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {orgs.length ? (
                      <ul className="space-y-0.5">
                        {orgs.map(o => (
                          <li key={o.id}>
                            <Link href={`/admin/companies/${o.id}`} className="hover:text-accent">{o.name}</Link>
                            <span className="text-muted"> · {o.role}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs">{u.plan}</td>
                  <td className="px-5 py-3 text-xs">
                    {u.isPlatformAdmin ? <span className="text-emerald-400">Yes</span> : <span className="text-muted">No</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
