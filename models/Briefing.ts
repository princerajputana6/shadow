import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface BriefingDoc extends Document {
  userId: Types.ObjectId
  date: string // YYYY-MM-DD in user's timezone
  prospectsContacted: number
  repliesReceived: number
  leadsQualified: number
  meetingsBooked: number
  summaryText?: string
  leadsSnapshot?: unknown[]
  meetingsSnapshot?: unknown[]
  createdAt: Date
}

const BriefingSchema = new Schema<BriefingDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: String, required: true },
  prospectsContacted: { type: Number, default: 0 },
  repliesReceived: { type: Number, default: 0 },
  leadsQualified: { type: Number, default: 0 },
  meetingsBooked: { type: Number, default: 0 },
  summaryText: String,
  leadsSnapshot: [Schema.Types.Mixed],
  meetingsSnapshot: [Schema.Types.Mixed],
  createdAt: { type: Date, default: Date.now }
})

BriefingSchema.index({ userId: 1, date: 1 }, { unique: true })

const Briefing: Model<BriefingDoc> =
  (mongoose.models.Briefing as Model<BriefingDoc>) ||
  mongoose.model<BriefingDoc>('Briefing', BriefingSchema)

export default Briefing
