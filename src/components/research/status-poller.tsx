'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

interface StatusPollerProps {
  jobId: string
  initialStatus: 'pending' | 'processing' | 'completed' | 'failed'
}

export function StatusPoller({ jobId, initialStatus }: StatusPollerProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [pollCount, setPollCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Poll interval: 3 seconds for first 20 polls, then 10 seconds
  const pollInterval = pollCount < 20 ? 3000 : 10000
  const maxPolls = 60 // Stop after ~5 minutes of polling

  useEffect(() => {
    if (status !== 'processing' && status !== 'pending') return
    if (pollCount >= maxPolls) return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/research/jobs?id=${jobId}`)
        if (!res.ok) {
          throw new Error('Failed to fetch job status')
        }
        const data = await res.json()

        if (data.status !== status) {
          setStatus(data.status)
          if (data.status === 'completed' || data.status === 'failed') {
            // Refresh the page to show results
            router.refresh()
          }
        }
        setPollCount(prev => prev + 1)
      } catch (err) {
        console.error('Status poll failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to check status')
      }
    }

    const timer = setTimeout(checkStatus, pollInterval)
    return () => clearTimeout(timer)
  }, [status, pollCount, jobId, router, pollInterval])

  const handleManualRefresh = () => {
    router.refresh()
  }

  // Stopped polling - show manual refresh option
  if (pollCount >= maxPolls && (status === 'processing' || status === 'pending')) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Taking Longer Than Expected</h3>
            <p className="text-muted-foreground mb-4">
              Your research is still processing. This can happen with complex hypotheses.
            </p>
            <Button onClick={handleManualRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show processing state with auto-refresh notice
  if (status === 'processing') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Research in Progress</h3>
            <p className="text-muted-foreground mb-2">
              Your research is being processed. This page will automatically update.
            </p>
            <p className="text-sm text-muted-foreground">
              Checking every {pollInterval / 1000} seconds... ({pollCount} checks)
            </p>
            {error && (
              <Alert variant="destructive" className="mt-4 max-w-md mx-auto">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show pending state
  if (status === 'pending') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Research Queued</h3>
            <p className="text-muted-foreground">
              This research job is waiting to be processed. This page will automatically update.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // For completed/failed, return null - the parent will render the appropriate content
  return null
}
