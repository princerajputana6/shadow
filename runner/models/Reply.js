import mongoose from 'mongoose'

const ReplySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  prospectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prospect' },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  gmailMessageId: { type: String, required: true },
  gmailThreadId: { type: String, required: true, index: true },
  fromEmail: { type: String, required: true, lowercase: true },
  fromName: String,
  subject: String,
  body: { type: String, default: '' },
  receivedAt: { type: Date, required: true },
  processed: { type: Boolean, default: false },
  processedAt: Date,
  aiAnalysis: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
})

ReplySchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true })

export default mongoose.models.Reply || mongoose.model('Reply', ReplySchema)
