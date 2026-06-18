import mongoose from 'mongoose'

const MemorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    type: { type: String, enum: ['short_term', 'long_term', 'episodic', 'semantic'], default: 'long_term', index: true },
    importance: { type: Number, default: 3, min: 1, max: 5 },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false, index: true },
    source: { type: String, default: 'manual' },
    embedding: { type: [Number], default: [] },
    expiresAt: { type: Date, default: null },
    consolidatedFrom: { type: [mongoose.Schema.Types.ObjectId], ref: 'Memory', default: [] },
    consolidationNote: { type: String, default: null }
  },
  { timestamps: true }
)

MemorySchema.index({ userId: 1, archived: 1, pinned: -1, importance: -1, updatedAt: -1 })
MemorySchema.index({ key: 'text', value: 'text', tags: 'text' })
MemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })

export default mongoose.models.Memory || mongoose.model('Memory', MemorySchema)
