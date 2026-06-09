// Migrate the existing single-tenant user into a default Organization with all
// agents enabled at owner pricing (free). Makes the user a platform admin.
//
// Usage:
//   cd runner
//   USER_ID=<mongo user id> node scripts/seedDefaultOrg.js

import 'dotenv/config'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Organization from '../models/Organization.js'
import Membership from '../models/Membership.js'
import AgentSubscription, { AGENT_CATALOG } from '../models/AgentSubscription.js'

const userId = process.env.USER_ID
if (!userId) { console.error('USER_ID env var required'); process.exit(1) }

await connectDB()

const user = await User.findById(userId)
if (!user) { console.error('User not found:', userId); process.exit(1) }

// 1. Mark user as platform admin so they can reach /admin
if (!user.isPlatformAdmin) {
  user.isPlatformAdmin = true
  await user.save()
  console.log('Set isPlatformAdmin=true on', user.email)
}

// 2. Create or find Biztreck org for this user
const slug = 'biztreck'
let org = await Organization.findOne({ slug })
if (!org) {
  org = await Organization.create({
    name: 'Biztreck',
    slug,
    ownerUserId: user._id,
    contactEmail: user.email,
    website: 'https://www.biztreck.world/',
    industry: 'digital services',
    status: 'active',
    notes: 'Platform owner — full access, no charge.'
  })
  console.log('Created Organization:', org.name, org._id.toString())
} else {
  console.log('Org already exists:', org.name, org._id.toString())
}

// 3. Membership
const existingMembership = await Membership.findOne({ organizationId: org._id, userId: user._id })
if (!existingMembership) {
  await Membership.create({ organizationId: org._id, userId: user._id, role: 'owner' })
  console.log('Created Membership: owner')
} else {
  console.log('Membership already exists with role', existingMembership.role)
}

// 4. Enable every agent for free
for (const a of AGENT_CATALOG) {
  const existing = await AgentSubscription.findOne({ organizationId: org._id, agentKey: a.key })
  if (existing) {
    if (!existing.enabled) { existing.enabled = true; await existing.save(); console.log('Re-enabled', a.key) }
    else console.log('Already enabled:', a.key)
  } else {
    await AgentSubscription.create({
      organizationId: org._id, agentKey: a.key,
      enabled: true, monthlyPriceINR: 0, status: 'active'
    })
    console.log('Subscribed (free):', a.key)
  }
}

console.log('Done. Org id:', org._id.toString())
process.exit(0)
