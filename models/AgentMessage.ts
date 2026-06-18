// Agent-to-Agent communication channel.
// Agents post messages; recipient agents poll or are triggered via runner.

import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type MessageStatus = 'pending' | 'delivered' | 'processed' | 'failed'

export interface AgentMessageDoc extends Document {
  userId: Types.ObjectId
  // Routing
  fromAgent: string     // e.g. 'sales_finder', 'discovery', 'ceo'
  toAgent: string       // e.g. 'developer', 'social_media'
  // Payload
  subject: string
  payload: Record<string, unknown>
  // Lifecycle
  status: MessageStatus
  priority: number      // 1 (low) … 5 (urgent)
  processedAt?: Date
  errorMessage?: string
  // Optional: link to a run or task
  runId?: Types.ObjectId
  taskId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AgentMessageSchema = new Schema<AgentMessageDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromAgent: { type: String, required: true },
    toAgent: { type: String, required: true, index: true },
    subject: { type: String, required: true, maxlength: 300 },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'delivered', 'processed', 'failed'],
      default: 'pending',
      index: true
    },
    priority: { type: Number, default: 3, min: 1, max: 5 },
    processedAt: Date,
    errorMessage: String,
    runId: { type: Schema.Types.ObjectId, ref: 'AgentRun', default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null }
  },
  { timestamps: true }
)

AgentMessageSchema.index({ toAgent: 1, status: 1, priority: -1, createdAt: 1 })
AgentMessageSchema.index({ userId: 1, status: 1, createdAt: -1 })

const AgentMessage: Model<AgentMessageDoc> =
  (mongoose.models.AgentMessage as Model<AgentMessageDoc>) ||
  mongoose.model<AgentMessageDoc>('AgentMessage', AgentMessageSchema)

export default AgentMessage
