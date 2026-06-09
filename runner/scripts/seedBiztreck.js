// Seed (or update) the Biztreck business for a given user.
// Uses a hand-crafted profile based on biztreck.world (we know what they do).
//
// Usage:
//   cd runner
//   USER_ID=<mongo user id> node scripts/seedBiztreck.js

import 'dotenv/config'
import { connectDB } from '../lib/mongoose.js'
import Business from '../models/Business.js'

const userId = process.env.USER_ID
if (!userId) { console.error('USER_ID env var required'); process.exit(1) }

const profile = {
  name: 'Biztreck',
  website: 'https://www.biztreck.world/',
  slug: 'biztreck',
  description: 'Biztreck is a digital services studio that builds websites, mobile apps, ERPs, and custom internal tools for businesses — including sub-products TryLinqr, Servio, and Küddl.',
  services: ['ecommerce website', 'website redesign', 'mobile app (iOS + Android)', 'ERP system', 'custom internal tools', 'AI-powered automation'],
  idealCustomerProfile: 'Small to mid-size businesses (10-200 employees) in India, UAE, and SE Asia that need custom software but lack in-house engineering — D2C brands, manufacturers digitising operations, service businesses scaling beyond spreadsheets, and recently-funded startups building MVPs.',
  searchKeywords: [
    'need a new ecommerce website',
    'website redesign quote',
    'shopify migration developer',
    'looking for mobile app developer',
    'need iOS Android app built',
    'ERP for small manufacturing business',
    'custom CRM development',
    'replace spreadsheets with a system',
    'MVP development for startup',
    'D2C brand looking for tech partner',
    'website rebuild RFP',
    'small business automation software'
  ],
  excludeKeywords: [
    'web development company',
    'IT services firm',
    'outsourcing partner',
    'app development agency',
    'software development services',
    'hire dedicated developers',
    'offshore development center'
  ],
  regions: ['India', 'UAE'],
  active: true
}

await connectDB()
const existing = await Business.findOne({ userId, slug: profile.slug })
if (existing) {
  Object.assign(existing, profile, { userId })
  await existing.save()
  console.log('Updated Biztreck. id:', existing._id.toString())
} else {
  const b = await Business.create({ ...profile, userId })
  console.log('Created Biztreck. id:', b._id.toString(), 'slug:', b.slug)
}
process.exit(0)
