import mongoose, { Schema, Model, Document } from 'mongoose'
import { encrypt, decrypt } from '@/lib/crypto'

const safeEncrypt = (v: string | undefined) => (v ? encrypt(v) : v)
const safeDecrypt = (v: string | undefined) => {
  if (!v) return v
  try { return decrypt(v) } catch { return v }
}

export interface UserDoc extends Document {
  email: string
  name?: string
  company?: string
  passwordHash?: string
  plan: 'owner' | 'client_basic' | 'client_pro'
  isPlatformAdmin?: boolean  // can access /admin
  googleTokens?: {
    accessToken?: string
    refreshToken?: string
    expiryDate?: number
    scope?: string
  }
  githubTokens?: {
    accessToken?: string
    scope?: string
    login?: string
    connectedAt?: Date
  }
  bitbucketTokens?: {
    accessToken?: string
    refreshToken?: string
    username?: string
    expiryDate?: number
    connectedAt?: Date
  }
  jiraTokens?: {
    accessToken?: string
    refreshToken?: string
    cloudId?: string
    siteUrl?: string
    expiryDate?: number
    connectedAt?: Date
  }
  slackTokens?: {
    accessToken?: string
    teamId?: string
    teamName?: string
    connectedAt?: Date
  }
  searchProfile?: {
    niche?: string
    keywords?: string[]
    regions?: string[]
  }
  crmSheetId?: string
  createdAt: Date
}

const UserSchema = new Schema<UserDoc>(
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
    bitbucketTokens: {
      accessToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      refreshToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      username: String,
      expiryDate: Number,
      connectedAt: Date
    },
    jiraTokens: {
      accessToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      refreshToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      cloudId: String,
      siteUrl: String,
      expiryDate: Number,
      connectedAt: Date
    },
    slackTokens: {
      accessToken: { type: String, set: safeEncrypt, get: safeDecrypt },
      teamId: String,
      teamName: String,
      connectedAt: Date
    },
    searchProfile: {
      niche: { type: String, default: 'custom software development for SMBs' },
      keywords: { type: [String], default: ['looking for developer', 'need a website', 'need an app', 'hiring developers'] },
      regions: { type: [String], default: ['India'] }
    },
    crmSheetId: String,   // Google Sheets CRM (lead-gen), created on first run
    createdAt: { type: Date, default: Date.now }
  },
  { toObject: { getters: true }, toJSON: { getters: true } }
)

const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>('User', UserSchema)

export default User
