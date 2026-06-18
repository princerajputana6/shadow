import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type WorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type StepRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface StepRun {
  stepId: string
  agentName: string
  status: StepRunStatus
  startedAt?: Date
  completedAt?: Date
  input: Record<string, unknown>
  output: Record<string, unknown>
  error?: string
  attempt: number
}

export interface WorkflowRunDoc extends Document {
  userId: Types.ObjectId
  workflowId: Types.ObjectId
  status: WorkflowRunStatus
  context: Record<string, unknown>   // accumulated workflow state
  steps: StepRun[]
  startedAt: Date
  completedAt?: Date
  errorMessage?: string
  triggeredBy: string  // 'manual' | 'cron' | 'agent_message' | 'webhook'
  createdAt: Date
  updatedAt: Date
}

const StepRunSchema = new Schema<StepRun>(
  {
    stepId: String,
    agentName: String,
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
    startedAt: Date,
    completedAt: Date,
    input: { type: Schema.Types.Mixed, default: {} },
    output: { type: Schema.Types.Mixed, default: {} },
    error: String,
    attempt: { type: Number, default: 0 }
  },
  { _id: false }
)

const WorkflowRunSchema = new Schema<WorkflowRunDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workflowId: { type: Schema.Types.ObjectId, ref: 'WorkflowDef', required: true, index: true },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'cancelled'],
      default: 'running',
      index: true
    },
    context: { type: Schema.Types.Mixed, default: {} },
    steps: { type: [StepRunSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    errorMessage: String,
    triggeredBy: { type: String, default: 'manual' }
  },
  { timestamps: true }
)

WorkflowRunSchema.index({ userId: 1, status: 1, startedAt: -1 })

const WorkflowRun: Model<WorkflowRunDoc> =
  (mongoose.models.WorkflowRun as Model<WorkflowRunDoc>) ||
  mongoose.model<WorkflowRunDoc>('WorkflowRun', WorkflowRunSchema)

export default WorkflowRun
