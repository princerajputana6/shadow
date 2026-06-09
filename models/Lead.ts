import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type LeadStatus = 'new' | 'in_conversation' | 'meeting_scheduled' | 'proposal_sent' | 'won' | 'lost'
export type Requirement = 'website' | 'app' | 'erp' | 'ai' | 'other'

export interface LeadDoc extends Document {
  userId: Types.ObjectId
  businessId?: Types.ObjectId
  prospectId?: Types.ObjectId
  gmailThreadId?: string
  name?: string
  email: string
  company?: string
  requirement?: Requirement
  requirementDetail?: string
  budget?: string
  urgency: number
  status: LeadStatus
  lastReplyAt?: Date
  lastAnalysis?: Record<string, unknown>
  createdAt: Date
}

const LeadSchema = new Schema<LeadDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
  prospectId: { type: Schema.Types.ObjectId, ref: 'Prospect' },
  gmailThreadId: { type: String, index: true },
  name: String,
  email: { type: String, required: true, lowercase: true },
  company: String,
  requirement: { type: String, enum: ['website', 'app', 'erp', 'ai', 'other'] },
  requirementDetail: String,
  budget: String,
  urgency: { type: Number, default: 5, min: 1, max: 10 },
  status: {
    type: String,
    default: 'new',
    enum: ['new', 'in_conversation', 'meeting_scheduled', 'proposal_sent', 'won', 'lost']
  },
  lastReplyAt: Date,
  lastAnalysis: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

LeadSchema.index({ userId: 1, gmailThreadId: 1 })
LeadSchema.index({ userId: 1, email: 1 })

const Lead: Model<LeadDoc> =
  (mongoose.models.Lead as Model<LeadDoc>) || mongoose.model<LeadDoc>('Lead', LeadSchema)

export default Lead
