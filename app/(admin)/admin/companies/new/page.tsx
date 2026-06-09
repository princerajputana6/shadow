import { AGENT_CATALOG } from '@/models/AgentSubscription'
import { NewCompanyForm } from './_form'

export default function NewCompanyPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Onboard a company</h1>
        <p className="text-sm text-muted">
          Creates the org, the owner user, memberships, and per-agent subscriptions.
          The owner can sign in with email/password (if you set one) or "Continue with Google" using the same email.
        </p>
      </header>
      <NewCompanyForm agents={AGENT_CATALOG} />
    </div>
  )
}
