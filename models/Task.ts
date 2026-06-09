import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type TaskStatus = 'backlog' | 'triaging' | 'in_progress' | 'pr_open' | 'blocked' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskAssignedAgent = 'cto' | 'developer' | 'human'

export interface TaskDoc extends Document {
  organizationId: Types.ObjectId
  createdByUserId: Types.ObjectId
  title: string
  description?: string
  repoUrl?: string
  branch?: string
  status: TaskStatus
  priority: TaskPriority
  assignedAgent: TaskAssignedAgent
  parentTaskId?: Types.ObjectId  // CTO breaks one task into many — children point back
  sourceLink?: string             // Jira ticket, Google Sheet row, GitHub issue
  prUrl?: string
  ctoPlan?: string                // CTO agent's breakdown
  developerNotes?: string         // Developer agent's diff summary
  errorMessage?: string
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

const TaskSchema = new Schema<TaskDoc>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: String,
  repoUrl: String,
  branch: String,
  status: { type: String, default: 'backlog', enum: ['backlog', 'triaging', 'in_progress', 'pr_open', 'blocked', 'done', 'cancelled'] },
  priority: { type: String, default: 'normal', enum: ['low', 'normal', 'high', 'urgent'] },
  assignedAgent: { type: String, default: 'human', enum: ['cto', 'developer', 'human'] },
  parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
  sourceLink: String,
  prUrl: String,
  ctoPlan: String,
  developerNotes: String,
  errorMessage: String,
  startedAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
})

TaskSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
TaskSchema.index({ organizationId: 1, assignedAgent: 1, status: 1 })

const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) || mongoose.model<TaskDoc>('Task', TaskSchema)

export default Task
