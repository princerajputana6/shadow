import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { connectDB } from '@/lib/mongoose'
import User from '@/models/User'
import { IntegrationCard } from './_components/IntegrationCard'

export const dynamic = 'force-dynamic'

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar'
]

export default async function IntegrationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  await connectDB()
  const user = await User.findById(session.user.id).lean()

  const g = user?.googleTokens
  const gScopes = (g?.scope || '').split(/\s+/).filter(Boolean)
  const googleScopeStatus = GOOGLE_SCOPES.every(s => gScopes.includes(s))

  const integrations = [
    {
      key: 'google',
      name: 'Google · Gmail + Calendar',
      description: 'The Sales agent uses Gmail to send outreach and read replies, and Calendar to book meetings.',
      connected: !!g?.refreshToken,
      detail: g?.refreshToken ? (googleScopeStatus ? 'All scopes granted' : 'Missing scopes — reconnect') : undefined,
      connectAction: '/api/integrations/google/connect',
      disconnectAction: '/api/integrations/google/disconnect',
      icon: 'gmail',
      requiredFor: ['Sales Rep', 'Researcher']
    },
    {
      key: 'github',
      name: 'GitHub',
      description: 'The Developer agent reads repo trees, fetches files, and opens draft pull requests.',
      connected: !!user?.githubTokens?.accessToken,
      detail: user?.githubTokens?.login ? `Connected as ${user.githubTokens.login}` : undefined,
      connectAction: '/api/integrations/github/start',
      disconnectAction: '/api/integrations/github/disconnect',
      icon: 'github',
      requiredFor: ['Dev', 'CTO']
    },
    {
      key: 'bitbucket',
      name: 'Bitbucket',
      description: 'Alternative source control for the Developer agent. Same workflow as GitHub.',
      connected: !!user?.bitbucketTokens?.accessToken,
      detail: user?.bitbucketTokens?.username ? `Connected as ${user.bitbucketTokens.username}` : undefined,
      connectAction: '/api/integrations/bitbucket/start',
      disconnectAction: '/api/integrations/bitbucket/disconnect',
      icon: 'bitbucket',
      requiredFor: ['Dev', 'CTO'],
      notConfigured: !process.env.BITBUCKET_CLIENT_ID
    },
    {
      key: 'jira',
      name: 'Jira',
      description: 'CTO agent reads tickets from Jira and converts them into structured engineering tasks.',
      connected: !!user?.jiraTokens?.accessToken,
      detail: user?.jiraTokens?.siteUrl ? `Connected to ${user.jiraTokens.siteUrl}` : undefined,
      connectAction: '/api/integrations/jira/start',
      disconnectAction: '/api/integrations/jira/disconnect',
      icon: 'jira',
      requiredFor: ['CTO'],
      notConfigured: !process.env.JIRA_CLIENT_ID
    },
    {
      key: 'slack',
      name: 'Slack',
      description: 'Optional. Post daily briefings + agent notifications to a Slack channel.',
      connected: !!user?.slackTokens?.accessToken,
      detail: user?.slackTokens?.teamName ? `Connected to ${user.slackTokens.teamName}` : undefined,
      connectAction: '/api/integrations/slack/start',
      disconnectAction: '/api/integrations/slack/disconnect',
      icon: 'slack',
      requiredFor: ['CEO'],
      notConfigured: !process.env.SLACK_CLIENT_ID
    }
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-1">Connections</p>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted">
          Connect the tools your agents need. Tokens are stored encrypted; you can disconnect any time.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {integrations.map(i => <IntegrationCard key={i.key} integration={i} />)}
      </div>
    </div>
  )
}
