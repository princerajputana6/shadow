// Thin Tavily Search API wrapper. Free tier: 1000 searches/month.
// Get key at https://tavily.com (signup → API Keys).

const TAVILY_URL = 'https://api.tavily.com/search'

export async function tavilySearch(query, { maxResults = 5, searchDepth = 'basic', topic } = {}) {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY is not set')
  const body = {
    api_key: apiKey,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false
  }
  if (topic) body.topic = topic // 'news' biases toward recent news articles
  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Tavily ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  // Tavily returns { results: [{ title, url, content, score }, ...] }
  return data.results || []
}
