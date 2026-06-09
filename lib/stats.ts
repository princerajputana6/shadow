import { connectDB } from '@/lib/mongoose'
import Prospect from '@/models/Prospect'
import Lead from '@/models/Lead'
import Meeting from '@/models/Meeting'
import Reply from '@/models/Reply'
import AgentRun from '@/models/AgentRun'

export type ActivityEvent = {
  kind: 'lead' | 'reply' | 'meeting' | 'run' | 'discovery'
  at: Date
  title: string
  detail?: string
  url?: string
}

export async function getDashboardSnapshot(userId: string) {
  await connectDB()
  const now = new Date()
  const startOfTodayIST = new Date(now.getTime() + 5.5 * 3600_000)
  startOfTodayIST.setUTCHours(0, 0, 0, 0)
  const startUTC = new Date(startOfTodayIST.getTime() - 5.5 * 3600_000)
  const endUTC = new Date(startUTC.getTime() + 86400_000)
  const last7d = new Date(now.getTime() - 7 * 86400_000)

  const [
    totalProspects, optedInProspects, contactedTotal, contactedToday,
    totalLeads, wonLeads, lostLeads, newLeadsToday, newLeadsWeek,
    totalMeetings, meetingsToday, upcomingMeetings,
    repliesToday,
    last7dByDay,
    recentLeads, recentReplies, recentMeetings, recentRuns
  ] = await Promise.all([
    Prospect.countDocuments({ userId }),
    Prospect.countDocuments({ userId, 'consent.granted': true }),
    Prospect.countDocuments({ userId, status: { $in: ['contacted', 'replied', 'qualified'] } }),
    Prospect.countDocuments({ userId, contactedAt: { $gte: startUTC, $lt: endUTC } }),
    Lead.countDocuments({ userId }),
    Lead.countDocuments({ userId, status: 'won' }),
    Lead.countDocuments({ userId, status: 'lost' }),
    Lead.countDocuments({ userId, createdAt: { $gte: startUTC, $lt: endUTC } }),
    Lead.countDocuments({ userId, createdAt: { $gte: last7d } }),
    Meeting.countDocuments({ userId }),
    Meeting.countDocuments({ userId, scheduledAt: { $gte: startUTC, $lt: endUTC } }),
    Meeting.find({ userId, scheduledAt: { $gte: now }, status: 'scheduled' })
      .sort({ scheduledAt: 1 }).limit(5).lean(),
    Reply.countDocuments({ userId, receivedAt: { $gte: startUTC, $lt: endUTC } }),
    Lead.aggregate([
      { $match: { userId: new (await import('mongoose')).default.Types.ObjectId(userId), createdAt: { $gte: last7d } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 }
      } },
      { $sort: { _id: 1 } }
    ]),
    Lead.find({ userId }).sort({ createdAt: -1 }).limit(10).select('name email company createdAt urgency').lean(),
    Reply.find({ userId }).sort({ receivedAt: -1 }).limit(10).select('fromName fromEmail subject receivedAt').lean(),
    Meeting.find({ userId }).sort({ createdAt: -1 }).limit(10).select('title scheduledAt meetLink createdAt').lean(),
    AgentRun.find({ userId }).sort({ startedAt: -1 }).limit(5).select('agentName status startedAt completedAt stats').lean()
  ])

  // Build activity feed (union, sorted desc)
  const events: ActivityEvent[] = []
  for (const l of recentLeads) {
    events.push({
      kind: 'lead',
      at: l.createdAt as Date,
      title: `New lead: ${l.name || l.email}`,
      detail: l.company ? `${l.company} · urgency ${l.urgency}/10` : `urgency ${l.urgency}/10`
    })
  }
  for (const r of recentReplies) {
    events.push({
      kind: 'reply',
      at: r.receivedAt as Date,
      title: `Reply from ${r.fromName || r.fromEmail}`,
      detail: r.subject || undefined
    })
  }
  for (const m of recentMeetings) {
    events.push({
      kind: 'meeting',
      at: m.createdAt as Date,
      title: `Meeting booked: ${m.title}`,
      detail: m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
      url: m.meetLink
    })
  }
  for (const r of recentRuns) {
    const stats = (r.stats as Record<string, number>) || {}
    events.push({
      kind: 'run',
      at: r.startedAt as Date,
      title: `${r.agentName.replace('_', ' ')} run · ${r.status}`,
      detail: r.status === 'completed'
        ? `${stats.contacted ?? 0} contacted · ${stats.newLeads ?? 0} new · ${stats.meetingsBooked ?? 0} booked`
        : undefined
    })
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const replyRate = contactedTotal > 0 ? Math.round((totalLeads / contactedTotal) * 100) : 0
  const winRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  return {
    counts: {
      totalProspects, optedInProspects,
      contactedTotal, contactedToday,
      totalLeads, newLeadsToday, newLeadsWeek,
      hotLeads: 0, // filled below
      wonLeads, lostLeads,
      totalMeetings, meetingsToday,
      repliesToday,
      replyRate, winRate
    },
    upcomingMeetings,
    last7dByDay: last7dByDay as { _id: string; count: number }[],
    events: events.slice(0, 15)
  }
}
