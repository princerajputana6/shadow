import mongoose from 'mongoose'

const StepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    agentName: { type: String, required: true },
    name: { type: String, required: true },
    inputMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    outputMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    condition: { type: String, default: null },
    retries: { type: Number, default: 0, min: 0, max: 3 }
  },
  { _id: false }
)

const WorkflowDefSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    trigger: { type: String, enum: ['manual', 'cron', 'agent_message', 'webhook'], default: 'manual' },
    cronExpression: { type: String, default: null },
    triggerAgent: { type: String, default: null },
    steps: { type: [StepSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
)

export default mongoose.models.WorkflowDef ||
  mongoose.model('WorkflowDef', WorkflowDefSchema)
