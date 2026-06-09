import mongoose, { Schema, Model, Document, Types } from 'mongoose'

export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram'
export type PostStatus = 'draft' | 'approved' | 'rejected' | 'posted'
export type PostTone = 'educational' | 'case_study' | 'opinion' | 'founder_story' | 'question'

export interface SocialPostDoc extends Document {
  userId: Types.ObjectId
  businessId: Types.ObjectId
  platform: SocialPlatform
  tone: PostTone
  content: string
  hashtags?: string[]
  status: PostStatus
  scheduledFor?: Date
  postedAt?: Date
  externalId?: string
  imagePrompt?: string
  createdAt: Date
}

const SocialPostSchema = new Schema<SocialPostDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  platform: { type: String, required: true, enum: ['twitter', 'linkedin', 'instagram'] },
  tone: { type: String, required: true, enum: ['educational', 'case_study', 'opinion', 'founder_story', 'question'] },
  content: { type: String, required: true },
  hashtags: [String],
  status: { type: String, required: true, default: 'draft', enum: ['draft', 'approved', 'rejected', 'posted'] },
  scheduledFor: Date,
  postedAt: Date,
  externalId: String,
  imagePrompt: String,
  createdAt: { type: Date, default: Date.now }
})

SocialPostSchema.index({ userId: 1, status: 1, createdAt: -1 })

const SocialPost: Model<SocialPostDoc> =
  (mongoose.models.SocialPost as Model<SocialPostDoc>) || mongoose.model<SocialPostDoc>('SocialPost', SocialPostSchema)

export default SocialPost
