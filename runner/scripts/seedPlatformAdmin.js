// Seeds a dedicated Platform Admin user that is NOT a member of any customer org.
// Demotes princerajputana5@gmail.com to a regular customer (owner of Biztreck only).
// Updates Biztreck's agent subscriptions to catalog default prices so it shows as
// a real paying customer in /admin views.
//
// Usage:
//   cd runner
//   node scripts/seedPlatformAdmin.js
//
// Override defaults with env:
//   ADMIN_EMAIL=foo@bar.com ADMIN_PASSWORD=secret ADMIN_NAME='Foo' node scripts/seedPlatformAdmin.js

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'
import Organization from '../models/Organization.js'
import Membership from '../models/Membership.js'
import AgentSubscription, { AGENT_CATALOG } from '../models/AgentSubscription.js'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@agentos.in').toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AgentOS@Admin2026'
const ADMIN_NAME = process.env.ADMIN_NAME || 'AgentOS Admin'

// The previous owner that we want to demote (Biztreck's customer-owner)
const CUSTOMER_OWNER_EMAIL = 'princerajputana5@gmail.com'

await connectDB()

console.log('━━━━ 1. Create / update Platform Admin ━━━━')
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
let admin = await User.findOne({ email: ADMIN_EMAIL })
if (admin) {
  admin.passwordHash = passwordHash
  admin.name = ADMIN_NAME
  admin.isPlatformAdmin = true
  await admin.save()
  console.log(`Updated existing admin: ${admin.email} (id ${admin._id})`)
} else {
  admin = await User.create({
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    passwordHash,
    plan: 'owner',
    isPlatformAdmin: true
  })
  console.log(`Created admin: ${admin.email} (id ${admin._id})`)
}

// Ensure admin is NOT a member of any customer org (cleanest separation).
const removedMemberships = await Membership.deleteMany({ userId: admin._id })
if (removedMemberships.deletedCount) {
  console.log(`Removed ${removedMemberships.deletedCount} stale memberships from admin`)
}

console.log()
console.log('━━━━ 2. Demote customer-owner ━━━━')
const customerOwner = await User.findOne({ email: CUSTOMER_OWNER_EMAIL })
if (customerOwner) {
  if (customerOwner.isPlatformAdmin) {
    customerOwner.isPlatformAdmin = false
    await customerOwner.save()
    console.log(`Removed isPlatformAdmin from ${customerOwner.email}`)
  } else {
    console.log(`${customerOwner.email} already has no admin flag`)
  }
} else {
  console.log(`⚠ Customer owner ${CUSTOMER_OWNER_EMAIL} not found — skipping demote`)
}

console.log()
console.log('━━━━ 3. Biztreck → real paying customer ━━━━')
const biztreck = await Organization.findOne({ slug: 'biztreck' })
if (biztreck) {
  biztreck.status = 'active'
  await biztreck.save()
  for (const a of AGENT_CATALOG) {
    const sub = await AgentSubscription.findOne({ organizationId: biztreck._id, agentKey: a.key })
    if (sub) {
      sub.enabled = true
      sub.monthlyPriceINR = a.defaultPriceINR
      sub.status = 'active'
      await sub.save()
      console.log(`  ${a.key}: enabled at ₹${a.defaultPriceINR}/mo`)
    } else {
      await AgentSubscription.create({
        organizationId: biztreck._id,
        agentKey: a.key,
        enabled: true,
        monthlyPriceINR: a.defaultPriceINR,
        status: 'active'
      })
      console.log(`  ${a.key}: created at ₹${a.defaultPriceINR}/mo`)
    }
  }
} else {
  console.log('⚠ Biztreck org not found — skipping price update')
}

console.log()
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Platform Admin credentials:')
console.log(`  URL:      http://localhost:3000/login`)
console.log(`  Email:    ${ADMIN_EMAIL}`)
console.log(`  Password: ${ADMIN_PASSWORD}`)
console.log()
console.log('Biztreck customer-owner login (unchanged email, no admin):')
console.log(`  Email:    ${CUSTOMER_OWNER_EMAIL}`)
console.log(`  Password: <whatever you set previously, default 'AgentOS@2026'>`)
console.log()
console.log('Biztreck shows up in /admin/companies as Active with MRR.')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
process.exit(0)
