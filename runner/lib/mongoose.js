import mongoose from 'mongoose'

let conn = null

export async function connectDB() {
  if (conn) return conn
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')
  conn = await mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 10 })
  return conn
}
