import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface KnowledgeVersion {
  content: string
  title: string
  editedAt: Date
  editedBy: Types.ObjectId
  changeNote: string
}

export interface KnowledgeDocDoc extends Document {
  userId: Types.ObjectId
  folderId?: Types.ObjectId
  title: string
  content: string
  tags: string[]
  // Semantic search
  embedding: number[]
  embeddingUpdatedAt?: Date
  // Version control
  version: number
  history: KnowledgeVersion[]
  // Metadata
  source: string      // 'manual' | 'agent_generated' | 'imported'
  pinned: boolean
  archived: boolean
  // Duplicate detection fingerprint
  contentHash: string
  createdAt: Date
  updatedAt: Date
}

const VersionSchema = new Schema<KnowledgeVersion>(
  {
    content: String,
    title: String,
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changeNote: { type: String, default: '' }
  },
  { _id: false }
)

const KnowledgeDocSchema = new Schema<KnowledgeDocDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'KnowledgeFolder', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    content: { type: String, required: true, maxlength: 100_000 },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], default: [] },
    embeddingUpdatedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
    history: { type: [VersionSchema], default: [] },
    source: { type: String, default: 'manual' },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false, index: true },
    contentHash: { type: String, default: '' }
  },
  { timestamps: true }
)

KnowledgeDocSchema.index({ userId: 1, archived: 1, pinned: -1, updatedAt: -1 })
KnowledgeDocSchema.index({ userId: 1, folderId: 1, archived: 1 })
KnowledgeDocSchema.index({ title: 'text', content: 'text', tags: 'text' })
KnowledgeDocSchema.index({ userId: 1, contentHash: 1 })

const KnowledgeDoc: Model<KnowledgeDocDoc> =
  (mongoose.models.KnowledgeDoc as Model<KnowledgeDocDoc>) ||
  mongoose.model<KnowledgeDocDoc>('KnowledgeDoc', KnowledgeDocSchema)

export default KnowledgeDoc
