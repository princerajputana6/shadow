import 'dotenv/config'
import express from 'express'
import cron from 'node-cron'
import { connectDB } from './lib/mongoose.js'
import User from './models/User.js'

const app = express()
app.use(express.json({ limit: '1mb' }))

function requireRunnerSecret(req, res, next) {
  if (req.headers['x-runner-secret'] !== process.env.RUNNER_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

app.post('/agents/sales/run', requireRunnerSecret, async (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  import('./agents/salesAgent.js')
    .then(({ runSalesAgent }) => runSalesAgent(userId).catch((e) => console.error('[sales]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId })
})

app.post('/agents/discovery/run', requireRunnerSecret, async (req, res) => {
  const { userId, businessId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  import('./agents/discoveryAgent.js')
    .then(({ runDiscoveryAgent }) => runDiscoveryAgent(userId, { businessId }).catch((e) => console.error('[discovery]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, businessId: businessId || null, agent: 'discovery' })
})

app.post('/agents/enrich/run', requireRunnerSecret, async (req, res) => {
  const { userId, businessId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  import('./agents/enrichProspect.js')
    .then(({ runEnrichment }) => runEnrichment(userId, { businessId }).catch((e) => console.error('[enrich]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, businessId: businessId || null, agent: 'enrichment' })
})

app.post('/agents/social/run', requireRunnerSecret, async (req, res) => {
  const { userId, businessId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  import('./agents/socialAgent.js')
    .then(({ runSocialAgent }) => runSocialAgent(userId, { businessId }).catch((e) => console.error('[social]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, businessId: businessId || null, agent: 'social' })
})

app.post('/agents/cto/run', requireRunnerSecret, async (req, res) => {
  const { taskId } = req.body || {}
  if (!taskId) return res.status(400).json({ error: 'taskId required' })
  import('./agents/ctoAgent.js')
    .then(({ runCtoAgent }) => runCtoAgent(taskId).catch((e) => console.error('[cto]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', taskId, agent: 'cto' })
})

app.post('/agents/developer/run', requireRunnerSecret, async (req, res) => {
  const { taskId } = req.body || {}
  if (!taskId) return res.status(400).json({ error: 'taskId required' })
  import('./agents/developerAgent.js')
    .then(({ runDeveloperAgent }) => runDeveloperAgent(taskId).catch((e) => console.error('[developer]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', taskId, agent: 'developer' })
})

async function listActiveUsers() {
  await connectDB()
  return User.find({ plan: { $in: ['owner', 'client_basic', 'client_pro'] } })
}

// 6:00 AM IST = 00:30 UTC — daily sales run
cron.schedule('30 0 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — daily sales run`)
  try {
    const users = await listActiveUsers()
    const { runSalesAgent } = await import('./agents/salesAgent.js')
    for (const u of users) {
      try { await runSalesAgent(u._id.toString()) }
      catch (e) { console.error(`[cron sales] user=${u._id} failed:`, e) }
    }
  } catch (e) { console.error('[cron sales] fatal:', e) }
})

// Every 12 hours — draft social posts for review (08:00 / 20:00 UTC)
cron.schedule('0 */12 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — social draft run`)
  try {
    const users = await listActiveUsers()
    const { runSocialAgent } = await import('./agents/socialAgent.js')
    for (const u of users) {
      try { await runSocialAgent(u._id.toString()) }
      catch (e) { console.error(`[cron social] user=${u._id} failed:`, e) }
    }
  } catch (e) { console.error('[cron social] fatal:', e) }
})

// Every 6 hours — discovery run (00:15 / 06:15 / 12:15 / 18:15 UTC)
cron.schedule('15 */6 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — discovery run`)
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[cron discovery] TAVILY_API_KEY not set — skipping')
    return
  }
  try {
    const users = await listActiveUsers()
    const { runDiscoveryAgent } = await import('./agents/discoveryAgent.js')
    for (const u of users) {
      try { await runDiscoveryAgent(u._id.toString()) }
      catch (e) { console.error(`[cron discovery] user=${u._id} failed:`, e) }
    }
  } catch (e) { console.error('[cron discovery] fatal:', e) }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`shadow-runner listening on :${PORT}`))
