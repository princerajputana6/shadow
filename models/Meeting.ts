import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface MeetingDoc extends Document {
  userId: Types.ObjectId
  leadId?: Types.ObjectId
  title: string
  scheduledAt: Date
  durationMinutes: number
  googleEventId?: string
  meetLink?: string
  status: MeetingStatus
  notes?: string
  createdAt: Date
}

const MeetingSchema = new Schema<MeetingDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
  title: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, default: 30 },
  googleEventId: String,
  meetLink: String,
  status: {
    type: String,
    default: 'scheduled',
    enum: ['scheduled', 'completed', 'cancelled', 'no_show']
  },
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

MeetingSchema.index({ userId: 1, scheduledAt: 1 })

const Meeting: Model<MeetingDoc> =
  (mongoose.models.Meeting as Model<MeetingDoc>) || mongoose.model<MeetingDoc>('Meeting', MeetingSchema)

export default Meeting
