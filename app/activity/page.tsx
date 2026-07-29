import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * TODO(stub): Full global / personal activity feed not built yet.
 * Linked from Global PoolCup Activity "View All".
 */
export default function ActivityPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="font-display text-3xl tracking-wide text-foreground">
        Activity
      </h1>
      <p className="text-sm text-muted-foreground">
        Full activity feed coming soon. Community highlights will live here.
      </p>
      <Button asChild variant="outline" className="w-fit gap-1.5">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </Button>
    </main>
  )
}
