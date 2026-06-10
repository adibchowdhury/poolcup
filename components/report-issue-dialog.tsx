'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/src/lib/supabase'

type ReportIssueContextValue = {
  openReportIssue: () => void
}

const ReportIssueContext = createContext<ReportIssueContextValue | null>(null)

export function useReportIssue(): ReportIssueContextValue {
  const context = useContext(ReportIssueContext)
  if (!context) {
    throw new Error('useReportIssue must be used within ReportIssueProvider')
  }
  return context
}

export function ReportIssueProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const openReportIssue = useCallback(() => {
    setError(null)
    setSuccess(false)
    setOpen(true)
  }, [])

  const resetForm = useCallback(() => {
    setMessage('')
    setError(null)
    setSuccess(false)
    setSubmitting(false)
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetForm()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = message.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('issue_reports').insert({
      message: trimmed,
      user_id: userId,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      metadata: {
        viewport: {
          w: window.innerWidth,
          h: window.innerHeight,
        },
      },
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message || 'Something went wrong. Please try again.')
      return
    }

    setSuccess(true)
    window.setTimeout(() => {
      setOpen(false)
      resetForm()
    }, 1400)
  }

  const value = useMemo(() => ({ openReportIssue }), [openReportIssue])

  const canSubmit = Boolean(message.trim()) && !submitting && !success

  return (
    <ReportIssueContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
            <DialogDescription>
              Tell us what went wrong and we will look into it.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <p className="py-6 text-center text-sm text-primary">
              Thanks, we got it
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-issue-message">What went wrong?</Label>
                <Textarea
                  id="report-issue-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what you were doing, what you expected, and what happened instead…"
                  rows={5}
                  disabled={submitting}
                  aria-invalid={Boolean(error)}
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {submitting ? 'Sending…' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </ReportIssueContext.Provider>
  )
}
