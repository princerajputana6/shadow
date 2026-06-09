import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface ReplyDoc extends Document {
  userId: Types.ObjectId
  prospectId?: Types.ObjectId
  leadId?: Types.ObjectId
  gmailMessageId: string
  gmailThreadId: string
  fromEmail: string
  fromName?: string
  subject?: string
  body?: string
  receivedAt: Date
  processed: boolean
  processedAt?: Date
  aiAnalysis?: Record<string, unknown>
  createdAt: Date
}

const ReplySchema = new Schema<ReplyDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  prospectId: { type: Schema.Types.ObjectId, ref: 'Prospect' },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  gmailMessageId: { type: String, required: true },
  gmailThreadId: { type: String, required: true, index: true },
  fromEmail: { type: String, required: true, lowercase: true },
  fromName: String,
  subject: String,
  body: { type: String, default: '' },
  receivedAt: { type: Date, required: true },
  processed: { type: Boolean, default: false },
  processedAt: Date,
  aiAnalysis: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

ReplySchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true })

const Reply: Model<ReplyDoc> =
  (mongoose.models.Reply as Model<ReplyDoc>) || mongoose.model<ReplyDoc>('Reply', ReplySchema)

export default Reply
