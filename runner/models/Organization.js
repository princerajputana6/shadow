import mongoose from 'mongoose'

const OrganizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contactEmail: { type: String, required: true, lowercase: true },
  contactPhone: String,
  website: String,
  industry: String,
  status: { type: String, required: true, default: 'trial', enum: ['active', 'trial', 'suspended', 'cancelled'] },
  trialEndsAt: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema)
