'use client'

import { useState, useTransition } from 'react'
import { approvePost, rejectPost, updatePostContent, markPosted } from '../actions'

type Post = {
  _id: string
  platform: 'twitter' | 'linkedin' | 'instagram'
  tone: string
  content: string
  hashtags?: string[]
  status: 'draft' | 'approved' | 'rejected' | 'posted'
  createdAt: string | Date
}

const PLATFORM_COLOR: Record<Post['platform'], string> = {
  twitter: 'bg-sky-500/10 text-sky-300',
  linkedin: 'bg-blue-600/10 text-blue-300',
  instagram: 'bg-pink-500/10 text-pink-300'
}

const STATUS_COLOR: Record<Post['status'], string> = {
  draft: 'bg-zinc-500/10 text-zinc-300',
  approved: 'bg-emerald-500/10 text-emerald-300',
  rejected: 'bg-red-500/10 text-red-300',
  posted: 'bg-violet-500/10 text-violet-300'
}

export function PostCard({ post }: { post: Post }) {
  const id = String(post._id)
  const [content, setContent] = useState(post.content)
  const [editing, setEditing] = useState(false)
  const [busy, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function save() {
    startTransition(async () => {
      try { await updatePostContent(id, content); setEditing(false); setMsg('Saved') }
      catch (e) { setMsg(e instanceof Error ? e.message : 'Failed') }
    })
  }
  function approve() { startTransition(async () => { await approvePost(id); setMsg('Approved') }) }
  function reject() { startTransition(async () => { await rejectPost(id); setMsg('Rejected') }) }
  function copyAndMark() {
    navigator.clipboard.writeText(post.hashtags?.length
      ? `${content}\n\n${post.hashtags.map(t => '#' + t).join(' ')}`
      : content)
    startTransition(async () => { await markPosted(id); setMsg('Copied + marked posted') })
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 space-y-3">
      <header className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 ${PLATFORM_COLOR[post.platform]}`}>{post.platform}</span>
          <span className="text-muted capitalize">{post.tone.replace('_', ' ')}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_COLOR[post.status]}`}>{post.status}</span>
      </header>

      {editing ? (
        <textarea
          rows={6} value={content} onChange={e => setContent(e.target.value)}
          className="w-full rounded-md border border-border bg-bg p-3 text-sm font-sans"
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      )}

      {!!post.hashtags?.length && (
        <p className="text-xs text-muted">{post.hashtags.map(t => '#' + t).join(' ')}</p>
      )}

      <footer className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted tabular-nums">{content.length} chars</span>
        <div className="flex-1" />
        {post.status === 'draft' && (
          <>
            <button onClick={() => setEditing(v => !v)} disabled={busy}
                    className="rounded-md border border-border px-2.5 py-1 hover:bg-border/30">
              {editing ? 'Cancel' : 'Edit'}
            </button>
            {editing && (
              <button onClick={save} disabled={busy}
                      className="rounded-md bg-accent px-2.5 py-1 font-medium text-black">Save</button>
            )}
            <button onClick={reject} disabled={busy}
                    className="rounded-md border border-border px-2.5 py-1 text-red-300 hover:bg-red-500/10">Reject</button>
            <button onClick={approve} disabled={busy}
                    className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-emerald-300">Approve</button>
          </>
        )}
        {post.status === 'approved' && (
          <button onClick={copyAndMark} disabled={busy}
                  className="rounded-md bg-accent px-2.5 py-1 font-medium text-black">Copy + mark posted</button>
        )}
      </footer>
      {msg && <p className="text-[11px] text-muted">{msg}</p>}
    </article>
  )
}
