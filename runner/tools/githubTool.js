// GitHub REST wrapper used by CTO + Developer agents.
// Avoids Octokit dep; uses plain fetch.

const API = 'https://api.github.com'

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agentos'
  }
}

async function gh(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${t.slice(0, 300)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function getRepoTree(token, owner, repo, branch = 'main') {
  // Get the latest commit on the branch, then its tree (recursive).
  const ref = await gh(token, 'GET', `/repos/${owner}/${repo}/git/refs/heads/${branch}`)
  const commitSha = ref.object.sha
  const commit = await gh(token, 'GET', `/repos/${owner}/${repo}/git/commits/${commitSha}`)
  const treeSha = commit.tree.sha
  const tree = await gh(token, 'GET', `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`)
  return {
    commitSha,
    files: (tree.tree || []).filter(t => t.type === 'blob').map(t => ({ path: t.path, sha: t.sha, size: t.size }))
  }
}

export async function getFileContent(token, owner, repo, path, ref) {
  const data = await gh(token, 'GET', `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref ? `?ref=${ref}` : ''}`)
  if (Array.isArray(data)) throw new Error(`${path} is a directory`)
  const content = Buffer.from(data.content, data.encoding || 'base64').toString('utf8')
  return { content, sha: data.sha, path: data.path }
}

export async function createBranch(token, owner, repo, baseBranch, newBranch) {
  const ref = await gh(token, 'GET', `/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`)
  await gh(token, 'POST', `/repos/${owner}/${repo}/git/refs`, {
    ref: `refs/heads/${newBranch}`,
    sha: ref.object.sha
  })
}

export async function upsertFile(token, owner, repo, path, content, message, branch, existingSha) {
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch
  }
  if (existingSha) body.sha = existingSha
  return gh(token, 'PUT', `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, body)
}

export async function openDraftPR(token, owner, repo, { head, base, title, body }) {
  return gh(token, 'POST', `/repos/${owner}/${repo}/pulls`, {
    title, body, head, base, draft: true
  })
}

export function shortFilesByExtension(files, allowedExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rb', '.java', '.md', '.json', '.css', '.html', '.yml', '.yaml']) {
  return files
    .filter(f => allowedExts.some(e => f.path.endsWith(e)))
    .filter(f => !f.path.startsWith('node_modules/') && !f.path.startsWith('.next/') && !f.path.startsWith('dist/') && !f.path.startsWith('build/'))
    .filter(f => f.size < 100_000)
}
