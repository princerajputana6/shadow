'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/mongoose'
import Business from '@/models/Business'
import Prospect from '@/models/Prospect'
import { extractBusinessProfile, slugify } from '@/lib/businessFromUrl'

async function authedUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

export async function addBusinessFromUrl(url: string) {
  const userId = await authedUserId()
  if (!url?.trim()) throw new Error('URL required')
  await connectDB()

  let profile
  try {
    profile = await extractBusinessProfile(url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // If Gemini is unavailable/quota exceeded, fall back to a stub profile
    // so the user can still add the business and fill details manually.
    if (
      msg.includes('GEMINI_API_KEY') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('network error') ||
      msg.includes('API error')
    ) {
      // Build a minimal profile from the URL itself
      const hostname = (() => { try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return url } })()
      const name = hostname.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      profile = {
        name,
        description: `Business at ${hostname}`,
        services: [],
        idealCustomerProfile: '',
        searchKeywords: [],
        excludeKeywords: [],
        regions: ['India']
      }
    } else {
      throw new Error(`Could not read that page: ${msg}`)
    }
  }

  if (!profile.name) throw new Error('Could not extract a business name from that page.')
  let slug = slugify(profile.name)
  let suffix = 0
  while (await Business.findOne({ userId, slug })) {
    suffix++; slug = `${slugify(profile.name)}-${suffix}`
  }
  const created = await Business.create({
    userId,
    name: profile.name,
    website: url.startsWith('http') ? url : `https://${url}`,
    slug,
    description: profile.description,
    services: profile.services,
    idealCustomerProfile: profile.idealCustomerProfile,
    searchKeywords: profile.searchKeywords,
    excludeKeywords: profile.excludeKeywords,
    regions: profile.regions,
    active: true
  })
  revalidatePath('/businesses')
  revalidatePath('/dashboard')
  return { id: String(created._id), name: created.name, stub: !profile.services?.length }
}

export async function updateBusiness(id: string, patch: {
  name?: string
  website?: string
  description?: string
  services?: string[]
  idealCustomerProfile?: string
  searchKeywords?: string[]
  excludeKeywords?: string[]
  regions?: string[]
  active?: boolean
}) {
  const userId = await authedUserId()
  await connectDB()
  const b = await Business.findOne({ _id: id, userId })
  if (!b) throw new Error('Not found')
  Object.assign(b, patch)
  await b.save()
  revalidatePath('/businesses')
}

export async function deleteBusiness(id: string) {
  const userId = await authedUserId()
  await connectDB()
  await Business.deleteOne({ _id: id, userId })
  // Detach prospects/leads — keep the records but unlink the businessId
  await Prospect.updateMany({ userId, businessId: id }, { $unset: { businessId: 1 } })
  revalidatePath('/businesses')
}

export async function runDiscoveryForBusiness(id: string) {
  const userId = await authedUserId()
  const runnerUrl = process.env.AGENT_RUNNER_URL
  const runnerSecret = process.env.RUNNER_SECRET
  if (!runnerUrl || !runnerSecret) throw new Error('Runner not configured')
  const res = await fetch(`${runnerUrl}/agents/discovery/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': runnerSecret },
    body: JSON.stringify({ userId, businessId: id })
  })
  if (!res.ok) throw new Error(`Runner ${res.status}: ${await res.text().catch(() => '')}`)
  revalidatePath('/businesses')
  revalidatePath('/discovery')
}
