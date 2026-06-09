import mongoose from 'mongoose'

const MembershipSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true, enum: ['owner', 'admin', 'member'] },
  createdAt: { type: Date, default: Date.now }
})

MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true })

export default mongoose.models.Membership || mongoose.model('Membership', MembershipSchema)
