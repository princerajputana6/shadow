import mongoose, { Schema, Model, Document } from 'mongoose'

export type SignupStatus = 'new' | 'contacted' | 'converted' | 'rejected'

export interface SignupLeadDoc extends Document {
  name: string
  email: string
  company: string
  phone?: string
  website?: string
  companySize: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'
  interestedAgents: string[]   // agent keys
  budgetRange: 'under_10k' | '10k_30k' | '30k_75k' | '75k_plus' | 'unsure'
  message?: string
  source?: string              // utm_source, etc.
  status: SignupStatus
  convertedOrgId?: mongoose.Types.ObjectId
  notes?: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

const SignupLeadSchema = new Schema<SignupLeadDoc>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  company: { type: String, required: true, trim: true },
  phone: String,
  website: String,
  companySize: { type: String, required: true, enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
  interestedAgents: { type: [String], default: [] },
  budgetRange: { type: String, required: true, enum: ['under_10k', '10k_30k', '30k_75k', '75k_plus', 'unsure'] },
  message: String,
  source: String,
  status: { type: String, default: 'new', enum: ['new', 'contacted', 'converted', 'rejected'], index: true },
  convertedOrgId: { type: Schema.Types.ObjectId, ref: 'Organization' },
  notes: String,
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
})

SignupLeadSchema.index({ createdAt: -1 })

const SignupLead: Model<SignupLeadDoc> =
  (mongoose.models.SignupLead as Model<SignupLeadDoc>) ||
  mongoose.model<SignupLeadDoc>('SignupLead', SignupLeadSchema)

export default SignupLead
