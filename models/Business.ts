import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export interface BusinessDoc extends Document {
  userId: Types.ObjectId
  name: string
  website: string
  slug: string                       // normalized name for Shadow voice matching
  description?: string               // what the business does, in 1-2 sentences
  services?: string[]                // what we sell (e.g. ['ecommerce', 'mobile app', 'ERP'])
  idealCustomerProfile?: string      // who buys from us
  searchKeywords?: string[]          // intent phrases to seed Tavily searches
  excludeKeywords?: string[]         // phrases that mean "this is a competitor / dev shop"
  regions?: string[]
  active: boolean
  lastDiscoveryAt?: Date
  createdAt: Date
}

const BusinessSchema = new Schema<BusinessDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

const Business: Model<BusinessDoc> =
  (mongoose.models.Business as Model<BusinessDoc>) || mongoose.model<BusinessDoc>('Business', BusinessSchema)

export default Business
