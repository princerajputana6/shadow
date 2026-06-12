import { google } from 'googleapis'
import { getOAuthClient } from './googleClient.js'

function calendarService(googleTokens) {
  return google.calendar({ version: 'v3', auth: getOAuthClient(googleTokens) })
}

// Build a Date for `hour:00` IST on a given local-IST day offset from now.
function istDateAt(daysAhead, hour) {
  // IST = UTC+5:30. We pick a UTC moment that maps to the desired IST clock.
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 3600_000)
  ist.setUTCHours(0, 0, 0, 0)
  ist.setUTCDate(ist.getUTCDate() + daysAhead)
  ist.setUTCHours(hour, 0, 0, 0)
  // ist is "what we want the IST clock to read"; convert back to real UTC.
  return new Date(ist.getTime() - 5.5 * 3600_000)
}

function istDayOfWeek(date) {
  // 0 = Sunday, 6 = Saturday — based on IST clock
  const ist = new Date(date.getTime() + 5.5 * 3600_000)
  return ist.getUTCDay()
}

export async function findFreeSlot({
  googleTokens,
  durationMinutes = 30,
  daysAhead = 3,
  workingStart = 10,
  workingEnd = 18
}) {
  const cal = calendarService(googleTokens)
  for (let day = 0; day <= daysAhead; day++) {
    const dayStart = istDateAt(day, workingStart)
    const dayEnd = istDateAt(day, workingEnd)
    if (dayStart < new Date()) {
      // Today: don't propose a slot in the past
      const now = new Date()
      if (now > dayEnd) continue
      if (now > dayStart) dayStart.setTime(now.getTime() + 30 * 60_000) // 30-min buffer
    }
    if ([0, 6].includes(istDayOfWeek(dayStart))) continue

    const { data } = await cal.events.list({
      calendarId: 'primary',
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })
    const events = (data.items || []).filter(
      (e) => e.start?.dateTime && e.end?.dateTime && e.status !== 'cancelled'
    )

    let cursor = new Date(dayStart)
    for (const e of events) {
      const eStart = new Date(e.start.dateTime)
      const eEnd = new Date(e.end.dateTime)
      const gap = eStart.getTime() - cursor.getTime()
      if (gap >= durationMinutes * 60_000) {
        return {
          start: cursor.toISOString(),
          end: new Date(cursor.getTime() + durationMinutes * 60_000).toISOString()
        }
      }
      if (eEnd > cursor) cursor = eEnd
    }
    if (dayEnd.getTime() - cursor.getTime() >= durationMinutes * 60_000) {
      return {
        start: cursor.toISOString(),
        end: new Date(cursor.getTime() + durationMinutes * 60_000).toISOString()
      }
    }
  }
  return null
}

export async function createMeeting({
  googleTokens, title, description, attendeeEmail, attendeeName, startTime, endTime
}) {
  const cal = calendarService(googleTokens)
  const requestId = `shadow-${attendeeEmail}-${Date.now()}`
  const { data } = await cal.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary: title,
      description,
      start: { dateTime: startTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime, timeZone: 'Asia/Kolkata' },
      attendees: [{ email: attendeeEmail, displayName: attendeeName }],
      conferenceData: { createRequest: { requestId } }
    }
  })
  return {
    eventId: data.id,
    meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || ''
  }
}
