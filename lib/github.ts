// Thin GitHub REST wrapper around fetch. Avoids pulling in @octokit/rest
// in the Next.js bundle. The runner can use the same wrapper.

export type GhRepo = {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  default_branch: string
  private: boolean
  description: string | null
  updated_at: string
}

const API = 'https://api.github.com'

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'shadow'
  }
}

export async function listUserRepos(token: string, { perPage = 50, page = 1 } = {}): Promise<GhRepo[]> {
  const url = `${API}/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator`
  const res = await fetch(url, { headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function getRepo(token: string, owner: string, name: string): Promise<GhRepo> {
  const res = await fetch(`${API}/repos/${owner}/${name}`, { headers: headers(token) })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.json()
}
