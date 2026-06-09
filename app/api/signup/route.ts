import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongoose'
import SignupLead from '@/models/SignupLead'

export const runtime = 'nodejs'

// In-memory rate limit: max 5 signups per IP per hour. Sufficient anti-spam for
// the landing form; for production swap to Upstash Redis.
const recentByIp = new Map<string, number[]>()
const HOUR = 60 * 60_000

function tooMany(ip: string): boolean {
  const now = Date.now()
  const arr = (recentByIp.get(ip) || []).filter(t => now - t < HOUR)
  arr.push(now)
  recentByIp.set(ip, arr)
  return arr.length > 5
}

const ALLOWED_AGENTS = ['sales_finder', 'lead_discovery', 'social_media', 'cto', 'developer']
const ALLOWED_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']
const ALLOWED_BUDGETS = ['under_10k', '10k_30k', '30k_75k', '75k_plus', 'unsure']

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'Too many requests — try again later.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const company = typeof body.company === 'string' ? body.company.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined
  const website = typeof body.website === 'string' ? body.website.trim() : undefined
  const companySize = typeof body.companySize === 'string' ? body.companySize : ''
  const interestedAgents = Array.isArray(body.interestedAgents)
    ? body.interestedAgents.filter((a: unknown) => typeof a === 'string' && ALLOWED_AGENTS.includes(a))
    : []
  const budgetRange = typeof body.budgetRange === 'string' ? body.budgetRange : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : undefined
  const source = typeof body.source === 'string' ? body.source.slice(0, 200) : undefined

  // Validation
  if (!name || name.length < 2) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!email || !/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  if (!company || company.length < 2) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  if (!ALLOWED_SIZES.includes(companySize)) return NextResponse.json({ error: 'Pick a company size' }, { status: 400 })
  if (!ALLOWED_BUDGETS.includes(budgetRange)) return NextResponse.json({ error: 'Pick a budget range' }, { status: 400 })

  await connectDB()

  // Block duplicate emails within last 7 days
  const recent = await SignupLead.findOne({
    email, createdAt: { $gte: new Date(Date.now() - 7 * 86400_000) }
  })
  if (recent) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      message: 'We already have your request — our team will be in touch shortly.'
    })
  }

  const doc = await SignupLead.create({
    name, email, company, phone, website,
    companySize, interestedAgents, budgetRange, message, source,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') || undefined,
    status: 'new'
  })

  return NextResponse.json({
    ok: true,
    id: String(doc._id),
    message: 'Got it — our team will be in touch within 24 hours.'
  })
}
