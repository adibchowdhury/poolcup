'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChatsPageView } from '@/components/chat/chats-page-view'
import { useAuth } from '@/src/lib/auth-context'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login?next=/chat')
    }
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return <ChatsPageView userId={user.id} />
}
