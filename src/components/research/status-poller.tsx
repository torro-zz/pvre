'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'

// Time thresholds for stuck job detection
const STUCK_JOB_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

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
  jobCreatedAt?: string // ISO timestamp for stuck job detection
  onResultsUpdate?: (results: ResearchResult[]) => void
  hidden?: boolean
}

export function StatusPoller({ jobId, initialStatus, hypothesis, jobCreatedAt, onResultsUpdate, hidden }: StatusPollerProps) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [pollCount, setPollCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunError, setRerunError] = useState<string | null>(null)
  const { notifyResearchComplete, requestPermission } = useNotifications()

  // Calculate if job is stuck (processing for > 5 minutes)
  const isJobStuck = (() => {
    if (!jobCreatedAt || status !== 'processing') return false
    const createdTime = new Date(jobCreatedAt).getTime()
    const now = Date.now()
    return (now - createdTime) > STUCK_JOB_THRESHOLD_MS
  })()

  // Handler for re-running stuck jobs
  const handleRerun = async () => {
    setIsRerunning(true)
    setRerunError(null)

    try {
      const response = await fetch('/api/research/jobs/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to re-run research')
      }

      const data = await response.json()
      // Redirect to new job
      router.push(`/research/${data.newJobId}`)
    } catch (err) {
      console.error('Re-run failed:', err)
      setRerunError(err instanceof Error ? err.message : 'Failed to re-run research')
      setIsRerunning(false)
    }
  }

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

  // Stopped polling or job is stuck - show re-run option
  if ((pollCount >= maxPolls || isJobStuck) && (status === 'processing' || status === 'pending')) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Taking Longer Than Expected</h3>
            <p className="text-muted-foreground mb-4">
              Your research appears to be stuck. You can re-run it to start fresh.
            </p>
            {rerunError && (
              <Alert variant="destructive" className="max-w-md mx-auto mb-4">
                <AlertDescription>{rerunError}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleManualRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </Button>
              <Button onClick={handleRerun} disabled={isRerunning}>
                {isRerunning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                {isRerunning ? 'Re-running...' : 'Re-run Research'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Re-running will create a new research job with the same hypothesis.
            </p>
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
