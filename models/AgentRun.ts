import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type AgentName = 'sales_finder' | 'social_media' | 'cto' | 'developer'
export type RunStatus = 'running' | 'completed' | 'failed'

export interface AgentRunDoc extends Document {
  userId: Types.ObjectId
  businessId?: Types.ObjectId
  agentName: AgentName
  status: RunStatus
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  stats?: Record<string, unknown>
}

const AgentRunSchema = new Schema<AgentRunDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
  agentName: { type: String, required: true, enum: ['sales_finder', 'social_media', 'cto', 'developer'] },
  status: { type: String, required: true, enum: ['running', 'completed', 'failed'] },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  errorMessage: String,
  stats: Schema.Types.Mixed
})

AgentRunSchema.index({ userId: 1, agentName: 1, startedAt: -1 })

const AgentRun: Model<AgentRunDoc> =
  (mongoose.models.AgentRun as Model<AgentRunDoc>) ||
  mongoose.model<AgentRunDoc>('AgentRun', AgentRunSchema)

export default AgentRun
