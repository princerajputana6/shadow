import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY
  if (!raw) throw new Error('TOKEN_ENC_KEY is not set')
  // Accept any-length secret; derive a 32-byte key deterministically.
  return createHash('sha256').update(raw).digest()
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: base64( iv | tag | ciphertext )
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decrypt(payload: string): string {
  if (!payload) return ''
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
