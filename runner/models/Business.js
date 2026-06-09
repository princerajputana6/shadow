import mongoose from 'mongoose'

const BusinessSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  website: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: String,
  services: [String],
  idealCustomerProfile: String,
  searchKeywords: { type: [String], default: [] },
  excludeKeywords: { type: [String], default: [] },
  regions: { type: [String], default: ['India'] },
  active: { type: Boolean, default: true },
  lastDiscoveryAt: Date,
  createdAt: { type: Date, default: Date.now }
})

BusinessSchema.index({ userId: 1, slug: 1 }, { unique: true })

export default mongoose.models.Business || mongoose.model('Business', BusinessSchema)
