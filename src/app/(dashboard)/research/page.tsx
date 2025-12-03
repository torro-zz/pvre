'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HypothesisForm } from '@/components/research/hypothesis-form'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Filter, Search, MessageSquare, Sparkles, X, HelpCircle, TrendingUp, Shield, Target, CreditCard, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CoverageData } from '@/components/research/coverage-preview'
import { StructuredHypothesis } from '@/types/research'

type ResearchStatus = 'idle' | 'loading' | 'success' | 'error'

interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete'
  detail?: string
  data?: Record<string, unknown>
}

interface StreamProgress {
  postsFound?: number
  commentsFound?: number
  relevantPosts?: number
  relevantComments?: number
  filterRate?: number
  subreddits?: string[]
  painSignalCount?: number
  themeCount?: number
}

export default function ResearchPage() {
  const router = useRouter()
  const [status, setStatus] = useState<ResearchStatus>('idle')
  const [results, setResults] = useState<CommunityVoiceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [streamProgress, setStreamProgress] = useState<StreamProgress>({})
  const [currentMessage, setCurrentMessage] = useState<string>('')
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [currentHypothesis, setCurrentHypothesis] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Idempotency key for preventing duplicate job creation on network retries
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID())
  // Show "How it works" guide - persist dismissal in localStorage
  const [showGuide, setShowGuide] = useState<boolean | null>(null)
  // Credits state
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  // Fetch credits on mount
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/billing/credits')
        if (res.ok) {
          const data = await res.json()
          setCredits(data.balance)
        }
      } catch {
        // Fail silently - form will handle credit errors
      } finally {
        setCreditsLoading(false)
      }
    }
    fetchCredits()
  }, [])

  // Load guide dismissal state from localStorage
  useEffect(() => {
    const dismissed = localStorage.getItem('pvre-guide-dismissed')
    setShowGuide(dismissed !== 'true')
  }, [])

  const dismissGuide = () => {
    localStorage.setItem('pvre-guide-dismissed', 'true')
    setShowGuide(false)
  }

  // Warn user before closing tab during research
  useEffect(() => {
    if (status === 'loading') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = 'Research is still running. Closing now may lose your results and credit. Are you sure?'
        return e.returnValue
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [status])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const runResearch = async (hypothesis: string, coverageData?: CoverageData, structuredHypothesis?: StructuredHypothesis) => {
    setStatus('loading')
    setError(null)
    setResults(null)
    setStreamProgress({})
    setCurrentMessage('')

    // Initialize progress steps with IDs
    const initialSteps: ProgressStep[] = [
      { id: 'job', label: 'Creating research job', status: 'active' },
      { id: 'keywords', label: 'Extracting search keywords', status: 'pending' },
      { id: 'subreddits', label: 'Discovering relevant communities', status: 'pending' },
      { id: 'fetching', label: 'Fetching discussions', status: 'pending' },
      { id: 'filtering', label: 'Filtering for relevance', status: 'pending' },
      { id: 'analyzing', label: 'Analyzing pain signals', status: 'pending' },
      { id: 'themes', label: 'Extracting themes', status: 'pending' },
      { id: 'interview', label: 'Generating interview guide', status: 'pending' },
      { id: 'market', label: 'Analyzing market size', status: 'pending' },
      { id: 'timing', label: 'Analyzing market timing', status: 'pending' },
    ]
    setProgressSteps(initialSteps)

    try {
      // Step 1: Create a research job first (with coverage data and structured hypothesis if available)
      const jobResponse = await fetch('/api/research/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          hypothesis,
          coverageData,
          structuredHypothesis, // New: pass structured input for better research
        }),
      })

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json()
        throw new Error(errorData.error || 'Failed to create research job')
      }

      const job = await jobResponse.json()
      const jobId = job.id

      // Redirect to the results page - it shows all steps and handles incomplete research
      router.push(`/research/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create research job')
      setStatus('error')
      // Regenerate idempotency key so user can retry
      idempotencyKeyRef.current = crypto.randomUUID()
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

        {/* How It Works Guide - dismissible */}
        {showGuide && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-sm mb-3">How It Works</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">1</div>
                        <div>
                          <p className="font-medium">Describe the Problem</p>
                          <p className="text-muted-foreground text-xs">Tell us who&apos;s struggling and what problem they face. Use their language for best results.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">2</div>
                        <div>
                          <p className="font-medium">We Mine Reddit</p>
                          <p className="text-muted-foreground text-xs">AI finds relevant communities and analyzes discussions for pain signals, market data, and timing.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">3</div>
                        <div>
                          <p className="font-medium">Get Your Verdict</p>
                          <p className="text-muted-foreground text-xs">Receive a viability score, interview questions, and competitor analysis to validate your idea.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Pain Signals
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Competitor Intel
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Viability Score
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={dismissGuide}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss guide</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zero Credits State - show when user has no credits */}
        {!creditsLoading && credits === 0 ? (
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardContent className="py-8">
              <div className="text-center max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">You&apos;re Out of Credits</h3>
                <p className="text-muted-foreground mb-6">
                  Get more credits to continue validating your business ideas with real community data.
                </p>
                <div className="space-y-3">
                  <Link href="/dashboard">
                    <Button className="w-full sm:w-auto">
                      <Zap className="h-4 w-4 mr-2" />
                      Get More Credits
                    </Button>
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Each credit includes full research: Pain Analysis + Market Sizing + Timing + Competitor Intel
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Hypothesis Form */
          <div className="mb-8">
            <HypothesisForm onSubmit={runResearch} isLoading={status === 'loading'} />
          </div>
        )}

        {/* Loading State */}
        {status === 'loading' && (
          <>
            {/* Warning Banner */}
            <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <strong>Please keep this tab open.</strong> Research takes 1-2 minutes.
                Closing the tab may lose your results and credit.
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="py-8">
                <div className="space-y-6">
                  {/* Header with current message */}
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-medium">{currentMessage || 'Starting research...'}</span>
                  </div>

                <Progress value={getProgressPercentage()} className="h-2" />

                {/* Real-time Stats Display */}
                {(streamProgress.postsFound !== undefined || streamProgress.subreddits) && (
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Live Research Stats</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {streamProgress.subreddits && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            Communities
                          </div>
                          <p className="text-lg font-semibold">{streamProgress.subreddits.length}</p>
                        </div>
                      )}

                      {streamProgress.postsFound !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Search className="h-3 w-3" />
                            Posts Found
                          </div>
                          <p className="text-lg font-semibold">{streamProgress.postsFound}</p>
                        </div>
                      )}

                      {streamProgress.relevantPosts !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Filter className="h-3 w-3" />
                            Relevant
                          </div>
                          <p className="text-lg font-semibold text-green-600">{streamProgress.relevantPosts}</p>
                        </div>
                      )}

                      {streamProgress.filterRate !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Quality Filter
                          </div>
                          <p className="text-lg font-semibold">{streamProgress.filterRate.toFixed(0)}%</p>
                        </div>
                      )}

                      {streamProgress.painSignalCount !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            Pain Signals
                          </div>
                          <p className="text-lg font-semibold text-amber-600">{streamProgress.painSignalCount}</p>
                        </div>
                      )}

                      {streamProgress.themeCount !== undefined && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            Themes
                          </div>
                          <p className="text-lg font-semibold text-blue-600">{streamProgress.themeCount}</p>
                        </div>
                      )}
                    </div>

                    {streamProgress.subreddits && streamProgress.subreddits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {streamProgress.subreddits.map((sub) => (
                          <span
                            key={sub}
                            className="px-2 py-0.5 bg-background text-xs rounded-full border"
                          >
                            r/{sub}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress Steps */}
                <div className="space-y-2">
                  {progressSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 text-sm ${
                        step.status === 'pending'
                          ? 'text-muted-foreground'
                          : step.status === 'active'
                          ? 'text-primary font-medium'
                          : 'text-green-600'
                      }`}
                    >
                      {step.status === 'complete' ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      ) : step.status === 'active' ? (
                        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 flex-shrink-0" />
                      )}
                      <span>{step.label}</span>
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
          </>
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
