// Seed or upsert a User with email/password credentials.
// Usage:
//   cd runner
//   SEED_EMAIL=you@example.com SEED_PASSWORD=changeme SEED_NAME="Your Name" node scripts/seedUser.js
//
// For the Sales Agent to actually run, you still need to sign in with
// Google once at /login so Gmail + Calendar tokens get attached to the
// User doc. Email/password alone won't grant Google API access.

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectDB } from '../lib/mongoose.js'
import User from '../models/User.js'

const email = process.env.SEED_EMAIL?.toLowerCase()
const password = process.env.SEED_PASSWORD
const name = process.env.SEED_NAME || ''

if (!email || !password) {
  console.error('Set SEED_EMAIL and SEED_PASSWORD env vars.')
  process.exit(1)
}
if (password.length < 8) {
  console.error('SEED_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

await connectDB()
const passwordHash = await bcrypt.hash(password, 12)

const existing = await User.findOne({ email })
if (existing) {
  existing.passwordHash = passwordHash
  if (name) existing.name = name
  await existing.save()
  console.log(`Updated password for ${email} (id=${existing._id})`)
} else {
  const u = await User.create({ email, name, passwordHash, plan: 'owner' })
  console.log(`Created user ${email} (id=${u._id})`)
}

process.exit(0)
