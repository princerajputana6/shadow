import mongoose from 'mongoose'

const LeadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  prospectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prospect' },
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
  lastAnalysis: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

LeadSchema.index({ userId: 1, gmailThreadId: 1 })
LeadSchema.index({ userId: 1, email: 1 })

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema)
