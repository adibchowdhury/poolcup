'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Flag, MessageCircle, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getAvatarSrc } from '@/src/lib/avatars'
import { formatRelativeTimestamp } from '@/src/lib/points-transaction-feed'
import { supabase } from '@/src/lib/supabase'

export type PoolChatMemberProfile = {
  displayName: string
  avatar: string | null
}

type PoolMessage = {
  id: string
  pool_id: string
  user_id: string
  content: string
  created_at: string
}

type PoolChatTabProps = {
  poolId: string
  currentUserId: string
  poolCreatorUserId: string
  memberProfilesByUserId: Map<string, PoolChatMemberProfile>
}

function resolveAuthor(
  userId: string,
  profiles: Map<string, PoolChatMemberProfile>,
): PoolChatMemberProfile {
  return (
    profiles.get(userId) ?? {
      displayName: 'Member',
      avatar: null,
    }
  )
}

function ChatAuthorAvatar({
  name,
  avatar,
  isYou,
}: {
  name: string
  avatar: string | null
  isYou: boolean
}) {
  return (
    <div
      className={cn(
        'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold',
        isYou ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
      )}
    >
      {avatar ? (
        <Image
          src={getAvatarSrc(avatar)}
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 object-cover object-top"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

function ChatMessageRow({
  message,
  author,
  isYou,
  canDelete,
  canReport,
  onDelete,
  onReport,
  reported,
  deleting,
  reporting,
}: {
  message: PoolMessage
  author: PoolChatMemberProfile
  isYou: boolean
  canDelete: boolean
  canReport: boolean
  onDelete: () => void
  onReport: () => void
  reported: boolean
  deleting: boolean
  reporting: boolean
}) {
  return (
    <div
      className={cn(
        'flex gap-2',
        isYou ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <ChatAuthorAvatar name={author.displayName} avatar={author.avatar} isYou={isYou} />

      <div
        className={cn(
          'flex min-w-0 max-w-[85%] flex-col gap-1',
          isYou ? 'items-end' : 'items-start',
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold',
              isYou ? 'text-primary' : 'text-foreground',
            )}
          >
            {isYou ? 'You' : author.displayName}
          </span>
          <time
            className="text-[10px] text-muted-foreground"
            dateTime={message.created_at}
            suppressHydrationWarning
          >
            {formatRelativeTimestamp(message.created_at)}
          </time>
        </div>

        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed break-words',
            isYou
              ? 'rounded-tr-md bg-primary/15 text-foreground ring-1 ring-primary/25'
              : 'rounded-tl-md bg-muted/60 text-foreground',
          )}
        >
          {message.content}
        </div>

        {(canDelete || canReport) && (
          <div className="flex items-center gap-1">
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
            {canReport && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onReport}
                disabled={reporting || reported}
              >
                <Flag className="h-3 w-3" />
                {reported ? 'Reported' : 'Report'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function PoolChatTab({
  poolId,
  currentUserId,
  poolCreatorUserId,
  memberProfilesByUserId,
}: PoolChatTabProps) {
  const [messages, setMessages] = useState<PoolMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set())
  const [reportNotice, setReportNotice] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isPoolCreator = currentUserId === poolCreatorUserId

  const appendMessage = useCallback((message: PoolMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [...prev, message]
    })
  }, [])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('pool_messages')
      .select('id, pool_id, user_id, content, created_at')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to load pool messages:', error.message)
      setLoadError('Could not load messages.')
      setMessages([])
    } else {
      setMessages((data ?? []) as PoolMessage[])
    }

    setLoading(false)
  }, [poolId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`pool-messages-${poolId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pool_messages',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          appendMessage(payload.new as PoolMessage)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pool_messages',
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (!deletedId) return
          setMessages((prev) => prev.filter((m) => m.id !== deletedId))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [poolId, appendMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setSendError(null)

    const { data, error } = await supabase
      .from('pool_messages')
      .insert({
        pool_id: poolId,
        user_id: currentUserId,
        content,
      })
      .select('id, pool_id, user_id, content, created_at')
      .single()

    setSending(false)

    if (error) {
      console.error('Failed to send message:', error.message)
      setSendError('Could not send message.')
      return
    }

    if (data) {
      appendMessage(data as PoolMessage)
    }
    setDraft('')
  }

  async function handleDelete(messageId: string) {
    setDeletingId(messageId)

    const { error } = await supabase
      .from('pool_messages')
      .delete()
      .eq('id', messageId)

    setDeletingId(null)

    if (error) {
      console.error('Failed to delete message:', error.message)
      return
    }

    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  async function handleReport(message: PoolMessage) {
    setReportingId(message.id)
    setReportNotice(null)

    const { error } = await supabase.from('message_reports').insert({
      pool_id: poolId,
      message_id: message.id,
      reporter_id: currentUserId,
      reported_author_id: message.user_id,
      reported_content: message.content,
    })

    setReportingId(null)

    if (error) {
      console.error('Failed to report message:', error.message)
      return
    }

    setReportedIds((prev) => new Set(prev).add(message.id))
    setReportNotice('Thanks — this message has been reported.')
    window.setTimeout(() => setReportNotice(null), 4000)
  }

  const trimmedDraft = draft.trim()
  const canSend = trimmedDraft.length > 0 && !sending

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-primary opacity-30 blur-lg" />
          <MessageCircle className="relative h-6 w-6 text-primary" />
        </div>
        <h2 className="font-display text-2xl tracking-wide text-foreground">
          CHAT
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent" />
      </div>

      <div className="flex h-[min(32rem,calc(100dvh-16rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-primary via-[#ffb300] to-primary" />

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {loading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-muted/40"
                    aria-hidden
                  />
                ))}
              </div>
            ) : loadError ? (
              <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <p className="font-medium text-foreground">No messages yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Say hello to your pool — messages appear here for everyone in
                  the group.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isYou = message.user_id === currentUserId
                const author = resolveAuthor(
                  message.user_id,
                  memberProfilesByUserId,
                )
                const canDelete = isYou || isPoolCreator
                const canReport = !isYou

                return (
                  <ChatMessageRow
                    key={message.id}
                    message={message}
                    author={author}
                    isYou={isYou}
                    canDelete={canDelete}
                    canReport={canReport}
                    onDelete={() => void handleDelete(message.id)}
                    onReport={() => void handleReport(message)}
                    reported={reportedIds.has(message.id)}
                    deleting={deletingId === message.id}
                    reporting={reportingId === message.id}
                  />
                )
              })
            )}
            <div ref={messagesEndRef} aria-hidden />
          </div>

          {reportNotice ? (
            <p className="border-t border-border/60 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
              {reportNotice}
            </p>
          ) : null}

          <form
            onSubmit={(event) => void handleSend(event)}
            className="flex shrink-0 items-center gap-2 border-t border-border/60 p-3"
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message your pool…"
              disabled={sending}
              maxLength={500}
              className="min-w-0 flex-1"
              aria-label="Chat message"
            />
            <Button type="submit" disabled={!canSend} className="shrink-0 gap-2">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>

          {sendError ? (
            <p className="px-4 pb-3 text-xs text-destructive">{sendError}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
