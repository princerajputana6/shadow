import mongoose from 'mongoose'

const RepoSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  connectedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  defaultBranch: { type: String, default: 'main' },
  isPrivate: { type: Boolean, default: false },
  lastSyncedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
})

RepoSchema.index({ organizationId: 1, fullName: 1 }, { unique: true })

export default mongoose.models.Repo || mongoose.model('Repo', RepoSchema)
