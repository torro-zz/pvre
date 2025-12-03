'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'

interface ResearchTriggerProps {
  jobId: string
  hypothesis: string
}

type TriggerState = 'idle' | 'starting' | 'processing' | 'error'

export function ResearchTrigger({ jobId, hypothesis }: ResearchTriggerProps) {
  const router = useRouter()
  const [state, setState] = useState<TriggerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const hasTriggeredRef = useRef(false)

  // Poll interval: 3 seconds for first 20 polls, then 10 seconds
  const pollInterval = pollCount < 20 ? 3000 : 10000
  const maxPolls = 60 // Stop after ~5 minutes

  // Tab close warning while research is running
  useEffect(() => {
    if (state === 'starting' || state === 'processing') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = 'Research is still running. Closing now may lose your results and credit. Are you sure?'
        return e.returnValue
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [state])

  // Auto-trigger research on mount
  useEffect(() => {
    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true

    const triggerResearch = async () => {
      setState('starting')
      setError(null)

      try {
        // First check if job is still pending (might have changed)
        const statusRes = await fetch(`/api/research/jobs?id=${jobId}`)
        if (statusRes.ok) {
          const jobData = await statusRes.json()
          if (jobData.status !== 'pending') {
            // Job already started/completed, just poll
            setState('processing')
            return
          }
        }

        // Trigger the research
        const response = await fetch('/api/research/community-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hypothesis, jobId }),
        })

        if (!response.ok) {
          const data = await response.json()
          if (data.error === 'insufficient_credits') {
            throw new Error('You need credits to run research. Please purchase a credit pack.')
          }
          throw new Error(data.error || 'Failed to start research')
        }

        // Research completed successfully - refresh to show results
        router.refresh()
      } catch (err) {
        console.error('Research trigger failed:', err)
        setError(err instanceof Error ? err.message : 'Failed to start research')
        setState('error')
      }
    }

    triggerResearch()
  }, [jobId, hypothesis, router])

  // Poll for status changes while processing
  useEffect(() => {
    if (state !== 'processing') return
    if (pollCount >= maxPolls) return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/research/jobs?id=${jobId}`)
        if (!res.ok) throw new Error('Failed to fetch status')

        const data = await res.json()

        if (data.status === 'completed' || data.status === 'failed') {
          router.refresh()
        } else {
          setPollCount(prev => prev + 1)
        }
      } catch (err) {
        console.error('Status poll failed:', err)
        setPollCount(prev => prev + 1)
      }
    }

    const timer = setTimeout(checkStatus, pollInterval)
    return () => clearTimeout(timer)
  }, [state, pollCount, jobId, router, pollInterval])

  const handleRetry = () => {
    hasTriggeredRef.current = false
    setState('idle')
    setError(null)
    setPollCount(0)
    // Re-trigger on next render
    setTimeout(() => {
      hasTriggeredRef.current = false
      setState('idle')
    }, 0)
  }

  // Starting state
  if (state === 'idle' || state === 'starting') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Starting Research</h3>
            <p className="text-muted-foreground">
              Initializing analysis for your hypothesis...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Research Failed to Start</h3>
            <Alert variant="destructive" className="max-w-md mx-auto mb-4 text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Processing state (polling)
  if (pollCount >= maxPolls) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Sparkles className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Taking Longer Than Expected</h3>
            <p className="text-muted-foreground mb-4">
              Your research is still processing. This can happen with complex hypotheses.
            </p>
            <Button onClick={() => router.refresh()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Research in Progress</h3>
          <p className="text-muted-foreground mb-2">
            Analyzing Reddit discussions for pain signals, market size, and timing...
          </p>
          <p className="text-sm text-muted-foreground">
            This page will automatically update when complete.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Checking every {pollInterval / 1000}s... ({pollCount} checks)
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
