import mongoose from 'mongoose'

type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: Cached | undefined
}

const cached: Cached = globalThis.__mongoose ?? { conn: null, promise: null }
globalThis.__mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 10 })
  }
  cached.conn = await cached.promise
  return cached.conn
}
