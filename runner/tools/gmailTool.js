import { google } from 'googleapis'
import { getOAuthClient } from './googleClient.js'

function gmailService(googleTokens) {
  return google.gmail({ version: 'v1', auth: getOAuthClient(googleTokens) })
}

function encodeRFC2822({ from, to, subject, body, replyToMessageId, references }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8'
  ]
  if (replyToMessageId) lines.push(`In-Reply-To: ${replyToMessageId}`)
  if (references) lines.push(`References: ${references}`)
  lines.push('', body)
  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

export async function sendOutreach({ googleTokens, fromEmail, fromName, to, subject, body }) {
  const gmail = gmailService(googleTokens)
  const raw = encodeRFC2822({
    from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
    to, subject, body
  })
  const res = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  return { messageId: res.data.id, threadId: res.data.threadId }
}

function decodeBase64Url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractPlainText(payload) {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return htmlToText(decodeBase64Url(payload.body.data))
  }
  if (payload.parts) {
    // Prefer text/plain
    for (const p of payload.parts) {
      if (p.mimeType === 'text/plain' && p.body?.data) return decodeBase64Url(p.body.data)
    }
    // Fall back to text/html
    for (const p of payload.parts) {
      if (p.mimeType === 'text/html' && p.body?.data) return htmlToText(decodeBase64Url(p.body.data))
    }
    // Recurse into multipart/* containers
    for (const p of payload.parts) {
      const t = extractPlainText(p)
      if (t) return t
    }
  }
  return ''
}

function parseFrom(header) {
  // "Name <email@x.com>"  or  "email@x.com"
  if (!header) return { name: undefined, email: undefined }
  const m = header.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/)
  if (m) return { name: m[1]?.trim() || undefined, email: m[2].toLowerCase() }
  return { name: undefined, email: header.trim().toLowerCase() }
}

function getHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value
}

export async function fetchReplies({ googleTokens, sinceHours = 24, maxResults = 50 }) {
  const gmail = gmailService(googleTokens)
  const after = Math.floor((Date.now() - sinceHours * 3600_000) / 1000)
  const q = `in:inbox -from:me after:${after}`
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults })
  const messages = list.data.messages || []

  const replies = []
  for (const m of messages) {
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
    const payload = msg.data.payload
    const headers = payload?.headers || []
    const from = parseFrom(getHeader(headers, 'From'))
    const subject = getHeader(headers, 'Subject')
    const internalDate = msg.data.internalDate ? new Date(Number(msg.data.internalDate)) : new Date()
    let body = extractPlainText(payload).slice(0, 8000) // trim huge replies
    if (!body) {
      // Last-resort fallback: Gmail's `snippet` is always present.
      body = (msg.data.snippet || '').slice(0, 2000)
    }
    if (!from.email) continue
    replies.push({
      gmailMessageId: m.id,
      gmailThreadId: msg.data.threadId,
      fromEmail: from.email,
      fromName: from.name,
      subject,
      body,
      receivedAt: internalDate
    })
  }
  return replies
}
