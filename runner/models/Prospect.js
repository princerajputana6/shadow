import mongoose from 'mongoose'

const ProspectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: String,
  email: { type: String, required: true, lowercase: true, trim: true },
  company: String,
  linkedinUrl: String,
  phone: String,
  source: { type: String, required: true, enum: ['opted_in', 'referral', 'manual', 'import', 'discovered'] },
  discoveryNotes: String,
  discoverySignal: String,
  discoveryUrl: String,
  consent: {
    granted: { type: Boolean, default: false },
    grantedAt: Date,
    source: String
  },
  status: {
    type: String,
    default: 'not_contacted',
    enum: ['not_contacted', 'contacted', 'replied', 'qualified', 'disqualified', 'opted_out']
  },
  threadId: String,
  contactedAt: Date,
  repliedAt: Date,
  createdAt: { type: Date, default: Date.now }
})

ProspectSchema.index({ userId: 1, email: 1 }, { unique: true })
ProspectSchema.index({ userId: 1, status: 1 })

export default mongoose.models.Prospect || mongoose.model('Prospect', ProspectSchema)
