import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface ConversationDoc extends Document {
  userId: Types.ObjectId
  title: string
  pinned: boolean
  archived: boolean
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const ConversationSchema = new Schema<ConversationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New chat', trim: true },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

ConversationSchema.index({ userId: 1, pinned: -1, lastMessageAt: -1 })

const Conversation: Model<ConversationDoc> =
  (mongoose.models.Conversation as Model<ConversationDoc>) ||
  mongoose.model<ConversationDoc>('Conversation', ConversationSchema)

export default Conversation
