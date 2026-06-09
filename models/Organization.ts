import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled'

export interface OrganizationDoc extends Document {
  name: string
  slug: string
  ownerUserId: Types.ObjectId  // the primary contact / billing owner
  contactEmail: string
  contactPhone?: string
  website?: string
  industry?: string
  status: OrgStatus
  trialEndsAt?: Date
  notes?: string
  createdAt: Date
}

const OrganizationSchema = new Schema<OrganizationDoc>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  contactEmail: { type: String, required: true, lowercase: true },
  contactPhone: String,
  website: String,
  industry: String,
  status: { type: String, required: true, default: 'trial', enum: ['active', 'trial', 'suspended', 'cancelled'] },
  trialEndsAt: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now }
})

const Organization: Model<OrganizationDoc> =
  (mongoose.models.Organization as Model<OrganizationDoc>) || mongoose.model<OrganizationDoc>('Organization', OrganizationSchema)

export default Organization
