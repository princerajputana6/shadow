import mongoose from 'mongoose'

const BriefingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true },
  prospectsContacted: { type: Number, default: 0 },
  repliesReceived: { type: Number, default: 0 },
  leadsQualified: { type: Number, default: 0 },
  meetingsBooked: { type: Number, default: 0 },
  summaryText: String,
  leadsSnapshot: [mongoose.Schema.Types.Mixed],
  meetingsSnapshot: [mongoose.Schema.Types.Mixed],
  createdAt: { type: Date, default: Date.now }
})

BriefingSchema.index({ userId: 1, date: 1 }, { unique: true })

export default mongoose.models.Briefing || mongoose.model('Briefing', BriefingSchema)
