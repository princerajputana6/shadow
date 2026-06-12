// Seeds an internal "Shadow HQ" org owned by the platform admin so they can
// use all the customer-facing agents themselves. All agents enabled at ₹0
// (admin doesn't bill themselves) so they don't pollute MRR numbers in /admin.
//
// Usage:
//   cd runner
//   node scripts/seedAdminOrg.js
//
// Override admin email with:
//   ADMIN_EMAIL=foo@bar.com node scripts/seedAdminOrg.js

import 'dotenv/config'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Organization from '../models/Organization.js'
import Membership from '../models/Membership.js'
import AgentSubscription, { AGENT_CATALOG } from '../models/AgentSubscription.js'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@agentos.in').toLowerCase()

await connectDB()
const admin = await User.findOne({ email: ADMIN_EMAIL })
if (!admin) {
  console.error(`Admin user ${ADMIN_EMAIL} not found. Run scripts/seedPlatformAdmin.js first.`)
  process.exit(1)
}

const slug = 'shadow-hq'
let org = await Organization.findOne({ slug })
if (org) {
  console.log(`HQ org already exists (id ${org._id}). Refreshing memberships and subscriptions.`)
} else {
  org = await Organization.create({
    name: 'Shadow HQ',
    slug,
    ownerUserId: admin._id,
    contactEmail: admin.email,
    industry: 'platform internal',
    status: 'active',
    notes: 'Internal org for platform admin to use the same agents customers do. Not counted toward MRR.'
  })
  console.log(`Created HQ org (id ${org._id}).`)
}

const existingMembership = await Membership.findOne({ organizationId: org._id, userId: admin._id })
if (!existingMembership) {
  await Membership.create({ organizationId: org._id, userId: admin._id, role: 'owner' })
  console.log('Admin is now owner of Shadow HQ.')
}

for (const a of AGENT_CATALOG) {
  const existing = await AgentSubscription.findOne({ organizationId: org._id, agentKey: a.key })
  if (existing) {
    existing.enabled = true
    existing.monthlyPriceINR = 0           // ₹0 — internal use, no MRR
    existing.status = 'active'
    await existing.save()
    console.log(`  ${a.key.padEnd(16)} ✓ enabled at ₹0`)
  } else {
    await AgentSubscription.create({
      organizationId: org._id,
      agentKey: a.key,
      enabled: true,
      monthlyPriceINR: 0,
      status: 'active'
    })
    console.log(`  ${a.key.padEnd(16)} ✓ created at ₹0`)
  }
}

console.log()
console.log('Admin can now switch to /dashboard to see Shadow HQ\'s Command Center.')
process.exit(0)
