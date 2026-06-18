import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface KnowledgeFolderDoc extends Document {
  userId: Types.ObjectId
  name: string
  description: string
  color: string       // hex or tailwind color name
  icon: string        // emoji or icon name
  parentId?: Types.ObjectId
  archived: boolean
  createdAt: Date
  updatedAt: Date
}

const KnowledgeFolderSchema = new Schema<KnowledgeFolderDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '#6366f1' },
    icon: { type: String, default: '📁' },
    parentId: { type: Schema.Types.ObjectId, ref: 'KnowledgeFolder', default: null },
    archived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
)

KnowledgeFolderSchema.index({ userId: 1, archived: 1, name: 1 })

const KnowledgeFolder: Model<KnowledgeFolderDoc> =
  (mongoose.models.KnowledgeFolder as Model<KnowledgeFolderDoc>) ||
  mongoose.model<KnowledgeFolderDoc>('KnowledgeFolder', KnowledgeFolderSchema)

export default KnowledgeFolder
