import mongoose from 'mongoose'

const AgentRunSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  agentName: { type: String, required: true, enum: ['sales_finder', 'social_media', 'cto', 'developer'] },
  status: { type: String, required: true, enum: ['running', 'completed', 'failed'] },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  errorMessage: String,
  stats: mongoose.Schema.Types.Mixed
})

AgentRunSchema.index({ userId: 1, agentName: 1, startedAt: -1 })

export default mongoose.models.AgentRun || mongoose.model('AgentRun', AgentRunSchema)
