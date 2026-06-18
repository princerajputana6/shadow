import mongoose from 'mongoose'

const StepRunSchema = new mongoose.Schema(
  {
    stepId: String,
    agentName: String,
    status: { type: String, enum: ['pending', 'running', 'completed', 'failed', 'skipped'], default: 'pending' },
    startedAt: Date,
    completedAt: Date,
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    output: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: String,
    attempt: { type: Number, default: 0 }
  },
  { _id: false }
)

const WorkflowRunSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowDef', required: true, index: true },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'cancelled'],
      default: 'running',
      index: true
    },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    steps: { type: [StepRunSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    errorMessage: String,
    triggeredBy: { type: String, default: 'manual' }
  },
  { timestamps: true }
)

export default mongoose.models.WorkflowRun ||
  mongoose.model('WorkflowRun', WorkflowRunSchema)
