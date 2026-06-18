// Browser Agent — uses Playwright to browse the web, extract content,
// take screenshots, and fill forms. Useful for deep research, competitor
// monitoring, and extracting structured data from web pages.
//
// Requires: playwright installed in runner (npm install playwright --save)
// Run once after install: npx playwright install chromium

import { llm as claude } from '../lib/llm.js'
import { connectDB } from '../lib/mongoose.js'
import AgentRun from '../models/AgentRun.js'
import AgentMessage from '../models/AgentMessage.js'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

async function getPlaywright() {
  try {
    return await import('playwright')
  } catch {
    throw new Error('Playwright not installed. Run: npm install playwright && npx playwright install chromium')
  }
}

// runBrowserAgent(userId, { url, task, extractSchema? })
// task: natural language description of what to do on the page
// extractSchema: optional JSON schema for structured extraction
export async function runBrowserAgent(userId, { url, task, extractSchema, businessId } = {}) {
  if (!url) throw new Error('url is required')
  if (!task) throw new Error('task is required')

  await connectDB()
  const run = await AgentRun.create({
    userId, businessId: businessId || null,
    agentName: 'browser', status: 'running',
    stats: { url, task: task.slice(0, 100) }
  })

  let browser
  const stats = { pagesVisited: 0, screenshotsTaken: 0, extracted: null }

  try {
    const { chromium } = await getPlaywright()
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (compatible; ShadowBot/1.0; +https://shadow.ai)',
      viewport: { width: 1280, height: 800 }
    })
    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    stats.pagesVisited++

    // Wait for main content to load
    await page.waitForTimeout(1500)

    // Extract full text content
    const textContent = await page.evaluate(() => {
      const body = document.body.cloneNode(true)
      // Remove noise elements
      const remove = ['script', 'style', 'nav', 'footer', 'aside', '[aria-hidden="true"]']
      for (const sel of remove) {
        body.querySelectorAll(sel).forEach((el) => el.remove())
      }
      return body.innerText?.replace(/\s+/g, ' ').trim() || ''
    })

    // Take a screenshot for reference
    const screenshot = await page.screenshot({ type: 'png', fullPage: false })
    const screenshotBase64 = screenshot.toString('base64')
    stats.screenshotsTaken++

    // Ask LLM to perform the task against the extracted content
    const extractPrompt = extractSchema
      ? `Extract structured data matching this schema from the page content. Return valid JSON only.
Schema: ${JSON.stringify(extractSchema)}

Page content:
${textContent.slice(0, 6000)}`
      : `Perform the following task using the page content below. Return a clear, structured answer.

Task: ${task}

Page URL: ${url}
Page content:
${textContent.slice(0, 6000)}`

    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: extractPrompt }]
    })
    const resultText = res.content[0]?.type === 'text' ? res.content[0].text : ''

    let extracted = resultText
    if (extractSchema) {
      try {
        extracted = JSON.parse(resultText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
      } catch { /* keep as text */ }
    }
    stats.extracted = extracted

    await browser.close()
    browser = null

    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'completed', completedAt: new Date(),
      stats: { ...stats, screenshotBase64: screenshotBase64.slice(0, 100) + '...' }
    })

    return { extracted, screenshotBase64, textLength: textContent.length, url }
  } catch (err) {
    if (browser) await browser.close().catch(() => {})
    await AgentRun.findByIdAndUpdate(run._id, {
      status: 'failed', errorMessage: err.message, completedAt: new Date(), stats
    })
    throw err
  }
}

// Multi-page crawl — visits multiple URLs and consolidates findings.
export async function runBrowserCrawl(userId, { urls = [], task, maxPages = 5 } = {}) {
  await connectDB()
  const run = await AgentRun.create({
    userId,
    agentName: 'browser_crawl', status: 'running',
    stats: { totalUrls: urls.length, task: task?.slice(0, 100) }
  })

  const results = []
  let visited = 0
  for (const url of urls.slice(0, maxPages)) {
    try {
      const result = await runBrowserAgent(userId, { url, task })
      results.push({ url, extracted: result.extracted })
      visited++
    } catch (e) {
      results.push({ url, error: e.message })
    }
  }

  // Consolidate findings across pages
  const consolidatePrompt = `Consolidate the following per-page research findings into a single coherent summary. Task was: "${task}"

${results.map((r, i) => `[Page ${i + 1}] ${r.url}\n${typeof r.extracted === 'string' ? r.extracted : JSON.stringify(r.extracted)}`).join('\n\n')}`

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: consolidatePrompt }]
  })
  const consolidated = res.content[0]?.type === 'text' ? res.content[0].text : ''

  await AgentRun.findByIdAndUpdate(run._id, {
    status: 'completed', completedAt: new Date(),
    stats: { visited, totalUrls: urls.length, task: task?.slice(0, 100) }
  })

  return { consolidated, pages: results, visited }
}
