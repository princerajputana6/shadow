import { google } from 'googleapis'
import { getOAuthClient } from './googleClient.js'

// Google Sheets CRM. The sheet is the human-friendly control surface;
// MongoDB stays the source of truth. Columns are fixed (see HEADER).
// Requires the `spreadsheets` OAuth scope (see lib/auth.config.ts).

const SHEET_TITLE = 'Shadow CRM — Leads'
const TAB = 'Leads'
export const HEADER = [
  'Name', 'Title', 'Company', 'LinkedIn', 'Email',
  'Signal', 'FitScore', 'Status', 'LastContacted', 'NextStep', 'Notes', 'Updated'
]
// Column letters by index — keep in sync with HEADER order.
const COL = { status: 'H', lastContacted: 'I', nextStep: 'J', updated: 'L' }

function sheetsService(googleTokens) {
  return google.sheets({ version: 'v4', auth: getOAuthClient(googleTokens) })
}

function rowFromLead(lead) {
  return [
    lead.name || '', lead.title || '', lead.company || '', lead.linkedinUrl || '',
    lead.email || '', lead.signal || '', lead.fitScore ?? '', lead.status || 'New',
    lead.lastContacted || '', lead.nextStep || '', lead.notes || '',
    new Date().toISOString().slice(0, 16).replace('T', ' ')
  ]
}

// Create the CRM spreadsheet if the user doesn't have one yet. Mutates+saves
// `user.crmSheetId`. Returns { spreadsheetId, url }.
export async function ensureCrmSheet(user) {
  const sheets = sheetsService(user.googleTokens)

  if (user.crmSheetId) {
    return { spreadsheetId: user.crmSheetId, url: sheetUrl(user.crmSheetId) }
  }

  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `${SHEET_TITLE} (${user.email})` },
      sheets: [{ properties: { title: TAB } }]
    }
  })
  const spreadsheetId = created.data.spreadsheetId
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] }
  })
  user.crmSheetId = spreadsheetId
  await user.save()
  return { spreadsheetId, url: sheetUrl(spreadsheetId) }
}

export function sheetUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}

// Append new lead rows. `leads` = array of plain objects (see rowFromLead keys).
export async function appendLeads(googleTokens, spreadsheetId, leads) {
  if (!leads.length) return 0
  const sheets = sheetsService(googleTokens)
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: leads.map(rowFromLead) }
  })
  return leads.length
}

// Read all leads as { email, status, rowIndex } (rowIndex is 1-based incl header).
export async function readLeads(googleTokens, spreadsheetId) {
  const sheets = sheetsService(googleTokens)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId, range: `${TAB}!A2:L`
  })
  const rows = res.data.values || []
  return rows.map((r, i) => ({
    rowIndex: i + 2,                 // +1 for header, +1 for 1-based
    name: r[0] || '',
    company: r[2] || '',
    email: (r[4] || '').toLowerCase().trim(),
    status: (r[7] || '').trim()
  })).filter(r => r.email)
}

// Update Status/LastContacted/NextStep for the row matching `email`.
export async function updateLeadStatus(googleTokens, spreadsheetId, email, status, { nextStep } = {}) {
  const rows = await readLeads(googleTokens, spreadsheetId)
  const hit = rows.find(r => r.email === email.toLowerCase().trim())
  if (!hit) return false
  const sheets = sheetsService(googleTokens)
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const data = [
    { range: `${TAB}!${COL.status}${hit.rowIndex}`, values: [[status]] },
    { range: `${TAB}!${COL.updated}${hit.rowIndex}`, values: [[now]] }
  ]
  if (status === 'Contacted') data.push({ range: `${TAB}!${COL.lastContacted}${hit.rowIndex}`, values: [[now]] })
  if (nextStep) data.push({ range: `${TAB}!${COL.nextStep}${hit.rowIndex}`, values: [[nextStep]] })
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data }
  })
  return true
}
