import mongoose from 'mongoose'

const AgentMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromAgent: { type: String, required: true },
    toAgent: { type: String, required: true, index: true },
    subject: { type: String, required: true, maxlength: 300 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'processed', 'failed'],
      default: 'pending',
      index: true
    },
    priority: { type: Number, default: 3, min: 1, max: 5 },
    processedAt: Date,
    errorMessage: String,
    runId: { type: mongoose.Schema.Types.ObjectId, ref: 'AgentRun', default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null }
  },
  { timestamps: true }
)

AgentMessageSchema.index({ toAgent: 1, status: 1, priority: -1, createdAt: 1 })

export default mongoose.models.AgentMessage ||
  mongoose.model('AgentMessage', AgentMessageSchema)
