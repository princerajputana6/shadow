import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type MemberRole = 'owner' | 'admin' | 'member'

export interface MembershipDoc extends Document {
  organizationId: Types.ObjectId
  userId: Types.ObjectId
  role: MemberRole
  createdAt: Date
}

const MembershipSchema = new Schema<MembershipDoc>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true, enum: ['owner', 'admin', 'member'] },
  createdAt: { type: Date, default: Date.now }
})

MembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true })

const Membership: Model<MembershipDoc> =
  (mongoose.models.Membership as Model<MembershipDoc>) || mongoose.model<MembershipDoc>('Membership', MembershipSchema)

export default Membership
