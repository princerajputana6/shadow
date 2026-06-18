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

app.post('/agents/leadgen/run', requireRunnerSecret, async (req, res) => {
  const { userId, businessId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  import('./agents/leadgenAgent.js')
    .then(({ runLeadgenAgent }) => runLeadgenAgent(userId, { businessId }).catch((e) => console.error('[leadgen]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, businessId: businessId || null, agent: 'leadgen' })
})

app.post('/agents/browser/run', requireRunnerSecret, async (req, res) => {
  const { userId, url, task, extractSchema, businessId } = req.body || {}
  if (!userId || !url || !task) return res.status(400).json({ error: 'userId, url, and task required' })
  import('./agents/browserAgent.js')
    .then(({ runBrowserAgent }) =>
      runBrowserAgent(userId, { url, task, extractSchema, businessId }).catch((e) => console.error('[browser]', e))
    )
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, url, agent: 'browser' })
})

app.post('/agents/browser/crawl', requireRunnerSecret, async (req, res) => {
  const { userId, urls, task, maxPages } = req.body || {}
  if (!userId || !urls?.length || !task) return res.status(400).json({ error: 'userId, urls[], and task required' })
  import('./agents/browserAgent.js')
    .then(({ runBrowserCrawl }) =>
      runBrowserCrawl(userId, { urls, task, maxPages }).catch((e) => console.error('[browser_crawl]', e))
    )
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', userId, urlCount: urls.length, agent: 'browser_crawl' })
})

app.post('/agents/workflow/run', requireRunnerSecret, async (req, res) => {
  const { runId } = req.body || {}
  if (!runId) return res.status(400).json({ error: 'runId required' })
  import('./agents/workflowAgent.js')
    .then(({ runWorkflow }) => runWorkflow(runId).catch((e) => console.error('[workflow]', e)))
    .catch((e) => console.error('[import]', e))
  res.json({ status: 'started', runId, agent: 'workflow' })
})

// Agent message dispatch — poll and deliver pending messages to their target agents
app.post('/agents/messages/dispatch', requireRunnerSecret, async (req, res) => {
  const { agentName } = req.body || {}
  res.json({ status: 'started', agentName })
  import('./lib/agentMessageBus.js')
    .then(({ dispatchPendingMessages }) =>
      dispatchPendingMessages(agentName).catch((e) => console.error('[message_bus]', e))
    )
    .catch((e) => console.error('[import]', e))
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

// Every 6 hours (offset) — LinkedIn X-ray lead-gen run (03:45 / 09:45 / ... UTC)
cron.schedule('45 */6 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — leadgen run`)
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[cron leadgen] TAVILY_API_KEY not set — skipping')
    return
  }
  try {
    const users = await listActiveUsers()
    const { runLeadgenAgent } = await import('./agents/leadgenAgent.js')
    for (const u of users) {
      try { await runLeadgenAgent(u._id.toString()) }
      catch (e) { console.error(`[cron leadgen] user=${u._id} failed:`, e) }
    }
  } catch (e) { console.error('[cron leadgen] fatal:', e) }
})

// Every 6 hours — process agent-to-agent message queue
cron.schedule('20 */6 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — agent message dispatch`)
  try {
    const { dispatchPendingMessages } = await import('./lib/agentMessageBus.js')
    const result = await dispatchPendingMessages()
    console.log(`[cron messages] dispatched=${result.dispatched}`)
  } catch (e) { console.error('[cron messages] fatal:', e) }
})

// Daily at 01:30 UTC — memory maintenance (consolidation + summarization + expiry)
cron.schedule('30 1 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — memory maintenance`)
  try {
    const users = await listActiveUsers()
    const { consolidateMemories, autoSummarize, applyShortTermExpiry } = await import('./lib/memoryOps.js')
    for (const u of users) {
      try {
        const [c, s, e] = await Promise.all([
          consolidateMemories(u._id.toString()),
          autoSummarize(u._id.toString()),
          applyShortTermExpiry(u._id.toString())
        ])
        if (c + s + e > 0) console.log(`[cron memory] user=${u._id} consolidated=${c} summarized=${s} expiredTagged=${e}`)
      } catch (e2) { console.error(`[cron memory] user=${u._id} failed:`, e2) }
    }
  } catch (e) { console.error('[cron memory] fatal:', e) }
})

// Daily at 02:00 UTC — incremental embedding for memories + knowledge docs
cron.schedule('0 2 * * *', async () => {
  console.log(`[cron] ${new Date().toISOString()} — incremental embedding`)
  try {
    const users = await listActiveUsers()
    for (const u of users) {
      try {
        const res = await fetch(`${process.env.NEXTJS_URL || 'http://localhost:3000'}/api/knowledge/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-runner-secret': process.env.RUNNER_SECRET },
          body: JSON.stringify({ batchSize: 20, target: 'both' })
        })
        if (!res.ok) console.warn(`[cron embed] user=${u._id} HTTP ${res.status}`)
      } catch (e2) { console.error(`[cron embed] user=${u._id}:`, e2) }
    }
  } catch (e) { console.error('[cron embed] fatal:', e) }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`shadow-runner listening on :${PORT}`))
