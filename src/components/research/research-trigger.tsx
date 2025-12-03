'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Loader2, AlertCircle, RefreshCw, Sparkles, TrendingUp, Search, BarChart3, Timer } from 'lucide-react'

interface ResearchTriggerProps {
  jobId: string
  hypothesis: string
}

type TriggerState = 'idle' | 'starting' | 'processing' | 'error'

// Progress phases for visual feedback
const PROGRESS_PHASES = [
  { label: 'Finding relevant communities', icon: Search, duration: 15 },
  { label: 'Fetching Reddit discussions', icon: TrendingUp, duration: 30 },
  { label: 'Analyzing pain signals', icon: BarChart3, duration: 45 },
  { label: 'Calculating market size & timing', icon: Timer, duration: 60 },
]

export function ResearchTrigger({ jobId, hypothesis }: ResearchTriggerProps) {
  const router = useRouter()
  const [state, setState] = useState<TriggerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const hasTriggeredRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)

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

  // Track elapsed time for progress display
  useEffect(() => {
    if (state === 'starting') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
      }
      const timer = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [state])

  // Calculate current progress phase based on elapsed time
  const getCurrentPhase = () => {
    for (let i = PROGRESS_PHASES.length - 1; i >= 0; i--) {
      if (elapsedSeconds >= PROGRESS_PHASES[i].duration) {
        return i < PROGRESS_PHASES.length - 1 ? i + 1 : i
      }
    }
    return 0
  }

  const currentPhaseIndex = getCurrentPhase()
  const currentPhase = PROGRESS_PHASES[currentPhaseIndex]
  const PhaseIcon = currentPhase.icon
  const progressPercent = Math.min((elapsedSeconds / 120) * 100, 95) // Cap at 95% until done

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

  // Starting state - show progress phases
  if (state === 'idle' || state === 'starting') {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <PhaseIcon className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Research in Progress</h3>
            <p className="text-primary font-medium">{currentPhase.label}</p>
          </div>

          {/* Progress bar */}
          <div className="max-w-md mx-auto mb-6">
            <Progress value={progressPercent} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{elapsedSeconds}s elapsed</span>
              <span>~2 min total</span>
            </div>
          </div>

          {/* Phase indicators */}
          <div className="flex justify-center gap-4 mb-6">
            {PROGRESS_PHASES.map((phase, index) => {
              const Icon = phase.icon
              const isActive = index === currentPhaseIndex
              const isComplete = index < currentPhaseIndex
              return (
                <div
                  key={index}
                  className={`flex flex-col items-center transition-opacity ${
                    isActive ? 'opacity-100' : isComplete ? 'opacity-60' : 'opacity-30'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary text-white' : isComplete ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-sm text-muted-foreground text-center">
            This takes 1-2 minutes. Feel free to leave - results save automatically.
          </p>
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
