'use client'

import { useState } from 'react'
import { HypothesisForm } from '@/components/research/hypothesis-form'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'

type ResearchStatus = 'idle' | 'loading' | 'success' | 'error'

interface ProgressStep {
  label: string
  status: 'pending' | 'active' | 'complete'
}

export default function ResearchPage() {
  const [status, setStatus] = useState<ResearchStatus>('idle')
  const [results, setResults] = useState<CommunityVoiceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentHypothesis, setCurrentHypothesis] = useState<string | null>(null)

  const runResearch = async (hypothesis: string) => {
    setStatus('loading')
    setError(null)
    setResults(null)

    // Initialize progress steps
    setProgressSteps([
      { label: 'Creating research job', status: 'active' },
      { label: 'Discovering relevant subreddits', status: 'pending' },
      { label: 'Fetching Reddit discussions', status: 'pending' },
      { label: 'Analyzing pain signals', status: 'pending' },
      { label: 'Extracting themes', status: 'pending' },
      { label: 'Generating interview guide', status: 'pending' },
    ])

    try {
      // Step 1: Create a research job first
      const jobResponse = await fetch('/api/research/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hypothesis }),
      })

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json()
        throw new Error(errorData.error || 'Failed to create research job')
      }

      const job = await jobResponse.json()
      const jobId = job.id
      setCurrentJobId(jobId)
      setCurrentHypothesis(hypothesis)

      // Mark first step complete, start second
      setProgressSteps((prev) => {
        const updated = [...prev]
        updated[0].status = 'complete'
        updated[1].status = 'active'
        return updated
      })

      // Update job status to processing
      await fetch('/api/research/jobs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, status: 'processing' }),
      })

      // Simulate progress updates for remaining steps
      const progressInterval = setInterval(() => {
        setProgressSteps((prev) => {
          const currentActiveIndex = prev.findIndex((s) => s.status === 'active')
          if (currentActiveIndex >= 0 && currentActiveIndex < prev.length - 1) {
            const updated = [...prev]
            updated[currentActiveIndex].status = 'complete'
            updated[currentActiveIndex + 1].status = 'active'
            return updated
          }
          return prev
        })
      }, 3000)

      // Step 2: Run the research with jobId so results are saved
      const response = await fetch('/api/research/community-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hypothesis, jobId }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        // Update job status to failed
        await fetch('/api/research/jobs', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId, status: 'failed' }),
        })

        const errorData = await response.json()
        throw new Error(errorData.error || 'Research failed')
      }

      const data = await response.json()

      // Update job status to completed
      await fetch('/api/research/jobs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, status: 'completed' }),
      })

      // Mark all steps as complete
      setProgressSteps((prev) => prev.map((s) => ({ ...s, status: 'complete' as const })))

      setResults(data)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStatus('error')
    }
  }

  const getProgressPercentage = () => {
    const completed = progressSteps.filter((s) => s.status === 'complete').length
    return (completed / progressSteps.length) * 100
  }

  return (
    <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Community Voice Research</h1>
          <p className="text-muted-foreground">
            Discover what your target customers are saying on Reddit. Enter your
            business hypothesis to analyze pain points, themes, and generate
            interview questions.
          </p>
        </div>

        {/* Hypothesis Form */}
        <div className="mb-8">
          <HypothesisForm onSubmit={runResearch} isLoading={status === 'loading'} />
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">Analyzing communities...</span>
                </div>

                <Progress value={getProgressPercentage()} className="h-2" />

                <div className="space-y-3">
                  {progressSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 text-sm ${
                        step.status === 'pending'
                          ? 'text-muted-foreground'
                          : step.status === 'active'
                          ? 'text-primary font-medium'
                          : 'text-green-600'
                      }`}
                    >
                      {step.status === 'complete' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : step.status === 'active' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2" />
                      )}
                      {step.label}
                    </div>
                  ))}
                </div>

                {/* Skeleton preview */}
                <div className="pt-4 border-t space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-20" />
                    ))}
                  </div>
                  <Skeleton className="h-32" />
                  <div className="space-y-2">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'error' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Research Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {status === 'success' && results && (
          <CommunityVoiceResults
            results={results}
            jobId={currentJobId || undefined}
            hypothesis={currentHypothesis || undefined}
          />
        )}
    </div>
  )
}
