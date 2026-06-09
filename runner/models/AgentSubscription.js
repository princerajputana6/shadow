import mongoose from 'mongoose'

const AgentSubscriptionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  agentKey: { type: String, required: true, enum: ['sales_finder', 'lead_discovery', 'social_media', 'cto', 'developer'] },
  enabled: { type: Boolean, default: false },
  monthlyPriceINR: { type: Number, default: 0, min: 0 },
  status: { type: String, default: 'active', enum: ['active', 'paused', 'cancelled', 'past_due'] },
  startedAt: { type: Date, default: Date.now },
  cancelledAt: Date,
  externalSubscriptionId: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

AgentSubscriptionSchema.index({ organizationId: 1, agentKey: 1 }, { unique: true })

export default mongoose.models.AgentSubscription || mongoose.model('AgentSubscription', AgentSubscriptionSchema)

export const AGENT_CATALOG = [
  { key: 'sales_finder', name: 'Sales Finder', description: 'Cold outreach, reply qualification, meeting booking via Gmail + Calendar.', defaultPriceINR: 4999 },
  { key: 'lead_discovery', name: 'Lead Discovery', description: 'Surfaces candidate companies from public web search using Tavily + Hunter enrichment.', defaultPriceINR: 2999 },
  { key: 'social_media', name: 'Social Media', description: 'Drafts posts across Twitter/LinkedIn/Instagram. Approve to publish.', defaultPriceINR: 1999 },
  { key: 'cto', name: 'CTO Agent', description: 'Triage and break down engineering work, assign to Developer agents.', defaultPriceINR: 7999 },
  { key: 'developer', name: 'Developer Agent', description: 'Creates draft PRs against GitHub repos for human review.', defaultPriceINR: 9999 }
]
