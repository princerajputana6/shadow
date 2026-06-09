import mongoose from 'mongoose'

const MeetingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  title: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, default: 30 },
  googleEventId: String,
  meetLink: String,
  status: { type: String, default: 'scheduled', enum: ['scheduled', 'completed', 'cancelled', 'no_show'] },
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

MeetingSchema.index({ userId: 1, scheduledAt: 1 })

export default mongoose.models.Meeting || mongoose.model('Meeting', MeetingSchema)
