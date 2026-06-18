// Adds connect@biztreck.world as:
//   1. A platform admin (can access /admin)
//   2. An owner-level member of the Biztreck organization (can use /dashboard)
//
// Password defaults to the env var CONNECT_PASSWORD or 'Biztreck@2026'
//
// Usage:
//   cd runner
//   CONNECT_PASSWORD=YourPassword node scripts/seedConnectBiztreck.js

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Organization from '../models/Organization.js'
import Membership from '../models/Membership.js'
import AgentSubscription, { AGENT_CATALOG } from '../models/AgentSubscription.js'

const EMAIL = 'connect@biztreck.world'
const PASSWORD = process.env.CONNECT_PASSWORD || 'Biztreck@2026'
const NAME = 'Biztreck Connect'

await connectDB()
console.log('━━━━ 1. Upsert user connect@biztreck.world ━━━━')

const passwordHash = await bcrypt.hash(PASSWORD, 12)
let user = await User.findOne({ email: EMAIL })
if (user) {
  user.passwordHash = passwordHash
  user.name = NAME
  user.isPlatformAdmin = true
  user.plan = 'owner'
  await user.save()
  console.log(`Updated existing user: ${user.email} (id ${user._id})`)
} else {
  user = await User.create({
    email: EMAIL,
    name: NAME,
    passwordHash,
    plan: 'owner',
    isPlatformAdmin: true
  })
  console.log(`Created user: ${user.email} (id ${user._id})`)
}

console.log()
console.log('━━━━ 2. Ensure Biztreck org exists ━━━━')
let org = await Organization.findOne({ slug: 'biztreck' })
if (!org) {
  // Get the existing owner (princerajputana5@gmail.com) as ownerUserId
  const existingOwner = await User.findOne({ email: 'princerajputana5@gmail.com' })
  org = await Organization.create({
    name: 'Biztreck',
    slug: 'biztreck',
    ownerUserId: existingOwner?._id || user._id,
    contactEmail: EMAIL,
    industry: 'custom software',
    status: 'active'
  })
  console.log(`Created Biztreck org (id ${org._id})`)
} else {
  console.log(`Found Biztreck org (id ${org._id}) — status: ${org.status}`)
}

console.log()
console.log('━━━━ 3. Add connect@biztreck.world as Biztreck owner ━━━━')
const existingMembership = await Membership.findOne({ organizationId: org._id, userId: user._id })
if (existingMembership) {
  existingMembership.role = 'owner'
  await existingMembership.save()
  console.log('Updated existing membership to owner.')
} else {
  await Membership.create({ organizationId: org._id, userId: user._id, role: 'owner' })
  console.log('Created owner membership in Biztreck.')
}

console.log()
console.log('━━━━ 4. Ensure all agents enabled for Biztreck ━━━━')
for (const a of AGENT_CATALOG) {
  const sub = await AgentSubscription.findOne({ organizationId: org._id, agentKey: a.key })
  if (sub) {
    sub.enabled = true
    sub.status = 'active'
    await sub.save()
    console.log(`  ${a.key.padEnd(16)} ✓ active`)
  } else {
    await AgentSubscription.create({
      organizationId: org._id,
      agentKey: a.key,
      enabled: true,
      monthlyPriceINR: a.defaultPriceINR,
      status: 'active'
    })
    console.log(`  ${a.key.padEnd(16)} ✓ created`)
  }
}

console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('connect@biztreck.world credentials:')
console.log(`  URL:      https://shadow-seven-sooty.vercel.app/login`)
console.log(`  Email:    ${EMAIL}`)
console.log(`  Password: ${PASSWORD}`)
console.log()
console.log('This account has:')
console.log('  ✓ Platform admin access (/admin)')
console.log('  ✓ Biztreck company dashboard (/dashboard)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
process.exit(0)
