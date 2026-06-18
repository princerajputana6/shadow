import mongoose, { Schema, Model, Document, Types } from 'mongoose'

// AI memory store. Four cognitive types (per spec): short-term (recent context),
// long-term (durable user/business facts), episodic (events/meetings/activities),
// and semantic (definitions/concepts). Retrieved by the Shadow assistant to give
// it persistent recall across chats.
export type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic'
export const MEMORY_TYPES: MemoryType[] = ['short_term', 'long_term', 'episodic', 'semantic']

export interface MemoryDoc extends Document {
  userId: Types.ObjectId
  key: string                 // short label, e.g. "Company revenue"
  value: string               // the fact, e.g. "₹5Cr ARR as of 2026"
  type: MemoryType
  importance: number          // 1 (trivial) … 5 (critical)
  tags: string[]
  pinned: boolean
  archived: boolean
  source: string              // 'manual' | 'chat_extracted' | 'auto_summarized' | 'consolidated'
  // Semantic search
  embedding: number[]         // 768-dim Gemini text-embedding-004
  // Lifecycle
  expiresAt?: Date            // TTL — undefined = never expires
  // Consolidation lineage
  consolidatedFrom: Types.ObjectId[]
  consolidationNote?: string
  createdAt: Date
  updatedAt: Date
}

const MemorySchema = new Schema<MemoryDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    type: { type: String, enum: MEMORY_TYPES, default: 'long_term', index: true },
    importance: { type: Number, default: 3, min: 1, max: 5 },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false, index: true },
    source: { type: String, default: 'manual' },
    embedding: { type: [Number], default: [] },
    expiresAt: { type: Date, default: null, index: { expireAfterSeconds: 0, sparse: true } },
    consolidatedFrom: { type: [Schema.Types.ObjectId], ref: 'Memory', default: [] },
    consolidationNote: { type: String, default: null }
  },
  { timestamps: true }
)

// Retrieval ordering: pinned + most important + most recent first.
MemorySchema.index({ userId: 1, archived: 1, pinned: -1, importance: -1, updatedAt: -1 })
// Free-text-ish search across label + value.
MemorySchema.index({ key: 'text', value: 'text', tags: 'text' })
// Expiry support via TTL index on expiresAt (MongoDB drops doc when expiresAt < now)
MemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })

const Memory: Model<MemoryDoc> =
  (mongoose.models.Memory as Model<MemoryDoc>) || mongoose.model<MemoryDoc>('Memory', MemorySchema)

export default Memory
