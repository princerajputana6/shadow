import mongoose from 'mongoose'

const SocialPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
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

export default mongoose.models.SocialPost || mongoose.model('SocialPost', SocialPostSchema)
