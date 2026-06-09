import mongoose from 'mongoose'
import { encrypt, decrypt } from '../lib/crypto.js'

const safeEncrypt = (v) => (v ? encrypt(v) : v)
const safeDecrypt = (v) => {
  if (!v) return v
  try { return decrypt(v) } catch { return v }
}

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    name: String,
    company: String,
    passwordHash: String,
    plan: { type: String, default: 'owner', enum: ['owner', 'client_basic', 'client_pro'] },
    isPlatformAdmin: { type: Boolean, default: false },
    googleTokens: {
      accessToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      refreshToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      expiryDate: Number,
      scope: String
    },
    githubTokens: {
      accessToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      scope: String,
      login: String,
      connectedAt: Date
    },
    searchProfile: {
      niche: { type: String, default: 'custom software development for SMBs' },
      keywords: { type: [String], default: ['looking for developer', 'need a website', 'need an app', 'hiring developers'] },
      regions: { type: [String], default: ['India'] }
    },
    createdAt: { type: Date, default: Date.now }
  },
  { toObject: { getters: true }, toJSON: { getters: true } }
)

export default mongoose.models.User || mongoose.model('User', UserSchema)
