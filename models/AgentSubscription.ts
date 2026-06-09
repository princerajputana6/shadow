import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type AgentKey = 'sales_finder' | 'lead_discovery' | 'social_media' | 'cto' | 'developer'
export type SubStatus = 'active' | 'paused' | 'cancelled' | 'past_due'

export interface AgentSubscriptionDoc extends Document {
  organizationId: Types.ObjectId
  agentKey: AgentKey
  enabled: boolean
  monthlyPriceINR: number
  status: SubStatus
  startedAt: Date
  cancelledAt?: Date
  // Razorpay or other gateway IDs land here later
  externalSubscriptionId?: string
  notes?: string
  createdAt: Date
}

const AgentSubscriptionSchema = new Schema<AgentSubscriptionDoc>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
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

const AgentSubscription: Model<AgentSubscriptionDoc> =
  (mongoose.models.AgentSubscription as Model<AgentSubscriptionDoc>) ||
  mongoose.model<AgentSubscriptionDoc>('AgentSubscription', AgentSubscriptionSchema)

export default AgentSubscription

// Catalog used by the admin UI and seed scripts
export const AGENT_CATALOG: { key: AgentKey; name: string; description: string; defaultPriceINR: number }[] = [
  { key: 'sales_finder', name: 'Sales Finder', description: 'Cold outreach, reply qualification, meeting booking via Gmail + Calendar.', defaultPriceINR: 4999 },
  { key: 'lead_discovery', name: 'Lead Discovery', description: 'Surfaces candidate companies from public web search using Tavily + Hunter enrichment.', defaultPriceINR: 2999 },
  { key: 'social_media', name: 'Social Media', description: 'Drafts posts across Twitter/LinkedIn/Instagram. Approve to publish.', defaultPriceINR: 1999 },
  { key: 'cto', name: 'CTO Agent', description: 'Triage and break down engineering work, assign to Developer agents.', defaultPriceINR: 7999 },
  { key: 'developer', name: 'Developer Agent', description: 'Creates draft PRs against GitHub repos for human review.', defaultPriceINR: 9999 }
]
