'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'

export interface ResearchResult {
  id: string
  job_id: string
  module_name: string
  data: unknown
  created_at: string
}

interface StatusPollerProps {
  jobId: string
  initialStatus: 'pending' | 'processing' | 'completed' | 'failed'
  hypothesis?: string // For notification
  onResultsUpdate?: (results: ResearchResult[]) => void
  hidden?: boolean
}

export function StatusPoller({ jobId, initialStatus, hypothesis, onResultsUpdate, hidden }: StatusPollerProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [pollCount, setPollCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const { notifyResearchComplete, requestPermission } = useNotifications()

  // Request notification permission on mount if still processing
  useEffect(() => {
    if (initialStatus === 'processing' || initialStatus === 'pending') {
      requestPermission()
    }
  }, [initialStatus, requestPermission])

  // Poll interval: 3 seconds for first 20 polls, then 10 seconds
  const pollInterval = pollCount < 20 ? 3000 : 10000
  const maxPolls = 60 // Stop after ~5 minutes of polling

  useEffect(() => {
    if (status !== 'processing' && status !== 'pending') return
    if (pollCount >= maxPolls) return

    const checkStatus = async () => {
      try {
        // Fetch status and results in parallel for efficiency
        const [statusRes, resultsRes] = await Promise.all([
          fetch(`/api/research/jobs?id=${jobId}`),
          onResultsUpdate ? fetch(`/api/research/results?jobId=${jobId}`) : Promise.resolve(null)
        ])

        if (!statusRes.ok) {
          throw new Error('Failed to fetch job status')
        }
        const statusData = await statusRes.json()

        // Update results if callback provided and fetch succeeded
        if (resultsRes && resultsRes.ok && onResultsUpdate) {
          const resultsData = await resultsRes.json()
          onResultsUpdate(resultsData)
        }

        if (statusData.status !== status) {
          setStatus(statusData.status)
          if (statusData.status === 'completed') {
            // Show browser notification (if permitted and user not on this tab)
            if (hypothesis) {
              notifyResearchComplete(hypothesis)
            }
            // Refresh the page to show final results
            router.refresh()
          } else if (statusData.status === 'failed') {
            // Refresh the page to show error
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
  }, [status, pollCount, jobId, router, pollInterval, onResultsUpdate])

  const handleManualRefresh = () => {
    router.refresh()
  }

  // If hidden, return null but keep polling (effects still run)
  if (hidden) {
    return null
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
