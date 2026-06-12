// One-time migration: rename the AgentOS HQ org to Shadow HQ.
// Idempotent — safe to run multiple times.
//
// Usage:
//   cd runner
//   node scripts/renameAgentOsToShadow.js

import 'dotenv/config'
import { connectDB } from '../lib/mongoose.js'
import Organization from '../models/Organization.js'

await connectDB()

const renamed = await Organization.findOneAndUpdate(
  { slug: 'agentos-hq' },
  { $set: { name: 'Shadow HQ', slug: 'shadow-hq', notes: 'Internal org for platform admin to use the same agents customers do. Not counted toward MRR.' } },
  { new: true }
)
if (renamed) {
  console.log(`Renamed org to "${renamed.name}" with slug "${renamed.slug}"`)
} else {
  const existing = await Organization.findOne({ slug: 'shadow-hq' })
  if (existing) console.log(`Already renamed. id=${existing._id}`)
  else console.log('No AgentOS HQ org found to rename.')
}

process.exit(0)
