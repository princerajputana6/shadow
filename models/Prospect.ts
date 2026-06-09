import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type ProspectStatus =
  | 'not_contacted'
  | 'contacted'
  | 'replied'
  | 'qualified'
  | 'disqualified'
  | 'opted_out'

export interface ProspectDoc extends Document {
  userId: Types.ObjectId
  businessId?: Types.ObjectId
  name?: string
  email: string
  company?: string
  linkedinUrl?: string
  phone?: string
  source: 'opted_in' | 'referral' | 'manual' | 'import' | 'discovered'
  discoveryNotes?: string
  discoverySignal?: string
  discoveryUrl?: string
  consent: { granted: boolean; grantedAt?: Date; source?: string }
  status: ProspectStatus
  threadId?: string
  contactedAt?: Date
  repliedAt?: Date
  createdAt: Date
}

const ProspectSchema = new Schema<ProspectDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', index: true },
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

const Prospect: Model<ProspectDoc> =
  (mongoose.models.Prospect as Model<ProspectDoc>) ||
  mongoose.model<ProspectDoc>('Prospect', ProspectSchema)

export default Prospect
