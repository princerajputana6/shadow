// Workflow Builder — define multi-step agent chains.
// A WorkflowDef is a template; WorkflowRun is an execution instance.

import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface WorkflowStep {
  id: string            // local step id within the workflow
  agentName: string     // runner agent to call (e.g. 'discovery', 'social_media')
  name: string          // human label
  inputMapping: Record<string, string>   // maps workflow context keys → agent payload keys
  outputMapping: Record<string, string>  // maps agent result keys → workflow context keys
  condition?: string    // JS expression evaluated against context; skip step if false
  retries: number
}

export interface WorkflowDefDoc extends Document {
  userId: Types.ObjectId
  name: string
  description: string
  trigger: 'manual' | 'cron' | 'agent_message' | 'webhook'
  cronExpression?: string
  triggerAgent?: string
  steps: WorkflowStep[]
  active: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

const StepSchema = new Schema<WorkflowStep>(
  {
    id: { type: String, required: true },
    agentName: { type: String, required: true },
    name: { type: String, required: true },
    inputMapping: { type: Schema.Types.Mixed, default: {} },
    outputMapping: { type: Schema.Types.Mixed, default: {} },
    condition: { type: String, default: null },
    retries: { type: Number, default: 0, min: 0, max: 3 }
  },
  { _id: false }
)

const WorkflowDefSchema = new Schema<WorkflowDefDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    trigger: {
      type: String,
      enum: ['manual', 'cron', 'agent_message', 'webhook'],
      default: 'manual'
    },
    cronExpression: { type: String, default: null },
    triggerAgent: { type: String, default: null },
    steps: { type: [StepSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
)

WorkflowDefSchema.index({ userId: 1, active: 1 })

const WorkflowDef: Model<WorkflowDefDoc> =
  (mongoose.models.WorkflowDef as Model<WorkflowDefDoc>) ||
  mongoose.model<WorkflowDefDoc>('WorkflowDef', WorkflowDefSchema)

export default WorkflowDef
