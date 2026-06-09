import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface RepoDoc extends Document {
  organizationId: Types.ObjectId
  connectedByUserId: Types.ObjectId  // whose githubTokens to use
  owner: string                       // GitHub owner/login
  name: string                        // repo name
  fullName: string                    // owner/name
  defaultBranch: string
  isPrivate: boolean
  lastSyncedAt: Date
  createdAt: Date
}

const RepoSchema = new Schema<RepoDoc>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  connectedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  defaultBranch: { type: String, default: 'main' },
  isPrivate: { type: Boolean, default: false },
  lastSyncedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
})

RepoSchema.index({ organizationId: 1, fullName: 1 }, { unique: true })

const Repo: Model<RepoDoc> =
  (mongoose.models.Repo as Model<RepoDoc>) || mongoose.model<RepoDoc>('Repo', RepoSchema)

export default Repo
