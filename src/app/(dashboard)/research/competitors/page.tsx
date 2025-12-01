'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CompetitorResults } from '@/components/research/competitor-results'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Loader2, Building2, Plus, X, Lightbulb, ArrowLeft, Sparkles, Target, TrendingUp } from 'lucide-react'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { CompetitorSuggestion, CompetitorSuggestionsResult } from '@/app/api/research/competitor-suggestions/route'
import Link from 'next/link'

type ResearchStatus = 'idle' | 'loading' | 'success' | 'error'

interface ProgressStep {
  label: string
  status: 'pending' | 'active' | 'complete'
}

interface ExistingResearchData {
  hypothesis: string
  suggestedCompetitors: string[]
  smartSuggestions: CompetitorSuggestion[]
  jobId: string
}

// Wrapper component that uses useSearchParams
function CompetitorResearchContent() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId')
  const hypothesisParam = searchParams.get('hypothesis')

  const [status, setStatus] = useState<ResearchStatus>('idle')
  const [results, setResults] = useState<CompetitorIntelligenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [hypothesis, setHypothesis] = useState('')
  const [knownCompetitors, setKnownCompetitors] = useState<string[]>([])
  const [competitorInput, setCompetitorInput] = useState('')
  const [existingResearch, setExistingResearch] = useState<ExistingResearchData | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  // Load existing research data if jobId is provided
  useEffect(() => {
    async function loadExistingResearch() {
      if (!jobId) {
        // Check if hypothesis was passed as URL param
        if (hypothesisParam) {
          setHypothesis(decodeURIComponent(hypothesisParam))
        }
        return
      }

      setLoadingExisting(true)
      try {
        // Fetch job details to get hypothesis
        const jobResponse = await fetch(`/api/research/jobs?id=${jobId}`)
        if (!jobResponse.ok) throw new Error('Failed to fetch job')
        const jobData = await jobResponse.json()

        // Fetch smart competitor suggestions from our new endpoint
        const suggestionsResponse = await fetch(`/api/research/competitor-suggestions?jobId=${jobId}`)
        let suggestedCompetitors: string[] = []
        let smartSuggestions: CompetitorSuggestion[] = []

        if (suggestionsResponse.ok) {
          const suggestionsData: CompetitorSuggestionsResult = await suggestionsResponse.json()
          smartSuggestions = suggestionsData.suggestions || []
          suggestedCompetitors = suggestionsData.rawMentions || []
        }

        setExistingResearch({
          hypothesis: jobData.hypothesis,
          suggestedCompetitors,
          smartSuggestions,
          jobId,
        })

        // Pre-fill hypothesis
        setHypothesis(jobData.hypothesis)
      } catch (err) {
        console.error('Failed to load existing research:', err)
        // Non-critical error - just continue without pre-fill
      } finally {
        setLoadingExisting(false)
      }
    }

    loadExistingResearch()
  }, [jobId, hypothesisParam])

  const addCompetitor = () => {
    if (competitorInput.trim() && !knownCompetitors.includes(competitorInput.trim())) {
      setKnownCompetitors([...knownCompetitors, competitorInput.trim()])
      setCompetitorInput('')
    }
  }

  const removeCompetitor = (competitor: string) => {
    setKnownCompetitors(knownCompetitors.filter((c) => c !== competitor))
  }

  const runResearch = async () => {
    if (!hypothesis.trim()) return

    setStatus('loading')
    setError(null)
    setResults(null)

    setProgressSteps([
      { label: 'Analyzing business hypothesis', status: 'active' },
      { label: 'Identifying market competitors', status: 'pending' },
      { label: 'Analyzing competitive landscape', status: 'pending' },
      { label: 'Identifying market gaps', status: 'pending' },
      { label: 'Generating positioning recommendations', status: 'pending' },
    ])

    try {
      // Simulate progress updates
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
      }, 2500)

      const response = await fetch('/api/research/competitor-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hypothesis: hypothesis.trim(),
          knownCompetitors: knownCompetitors.length > 0 ? knownCompetitors : undefined,
          jobId: existingResearch?.jobId || undefined,
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Research failed')
      }

      const data = await response.json()

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

  const exampleHypotheses = [
    'AI-powered customer support chatbot for e-commerce',
    'Fitness tracking app for busy professionals',
    'Online learning platform for coding bootcamps',
    'Project management tool for remote design teams',
  ]

  return (
    <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          {existingResearch && (
            <Link href={`/research/${existingResearch.jobId}`}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Research
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold mb-2">Competitor Intelligence</h1>
          <p className="text-muted-foreground">
            Analyze your competitive landscape to identify market gaps and positioning opportunities.
            {existingResearch
              ? ' We\'ve pre-filled your hypothesis from your previous research.'
              : ' Enter your business hypothesis to discover competitors and strategic insights.'}
          </p>
        </div>

        {/* Research Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Competitor Analysis
            </CardTitle>
            <CardDescription>
              Enter your business idea to analyze the competitive landscape
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="hypothesis">Business Hypothesis</Label>
              {loadingExisting ? (
                <div className="space-y-2">
                  <Skeleton className="h-[100px] w-full" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Loading your hypothesis from previous research...
                  </p>
                </div>
              ) : (
                <>
                  <Textarea
                    id="hypothesis"
                    placeholder="e.g., AI-powered customer support chatbot for e-commerce businesses"
                    value={hypothesis}
                    onChange={(e) => setHypothesis(e.target.value)}
                    className="min-h-[100px]"
                    disabled={status === 'loading'}
                  />
                  <p className="text-sm text-muted-foreground">
                    Describe your business idea, target audience, or problem you want to solve.
                  </p>
                </>
              )}
            </div>

            {/* Example Hypotheses */}
            <div>
              <Label className="text-sm text-muted-foreground">Try an example:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {exampleHypotheses.map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setHypothesis(example)}
                    disabled={status === 'loading'}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>

            {/* Known Competitors */}
            <div className="space-y-2">
              <Label htmlFor="competitors">Known Competitors (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="competitors"
                  placeholder="Add a competitor name..."
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCompetitor()
                    }
                  }}
                  disabled={status === 'loading'}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCompetitor}
                  disabled={status === 'loading' || !competitorInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {knownCompetitors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {knownCompetitors.map((competitor) => (
                    <div
                      key={competitor}
                      className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm"
                    >
                      {competitor}
                      <button
                        onClick={() => removeCompetitor(competitor)}
                        className="hover:text-destructive"
                        disabled={status === 'loading'}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                If you already know some competitors, add them here for a more targeted analysis.
              </p>
            </div>

            {/* Smart Competitor Suggestions */}
            {existingResearch && existingResearch.smartSuggestions.length > 0 && (
              <div className="space-y-4 p-4 bg-muted/30 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-foreground/70" />
                  <Label className="font-medium">
                    AI-Suggested Competitors
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    from Community Voice
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  These competitors were identified from Reddit discussions. Click to add:
                </p>

                {/* Direct Competitors */}
                {existingResearch.smartSuggestions.filter(s => s.type === 'direct_competitor' && s.isActualProduct).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Direct Competitors
                      </span>
                    </div>
                    <div className="space-y-2">
                      {existingResearch.smartSuggestions
                        .filter(s => s.type === 'direct_competitor' && s.isActualProduct && !knownCompetitors.includes(s.name))
                        .map((suggestion) => (
                          <div
                            key={suggestion.name}
                            className="flex items-center justify-between p-2 bg-background rounded-md border hover:border-foreground/20 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{suggestion.name}</span>
                                <Badge
                                  variant={suggestion.confidence === 'high' ? 'default' : 'outline'}
                                  className="text-xs"
                                >
                                  {suggestion.confidence}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {suggestion.context}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setKnownCompetitors([...knownCompetitors, suggestion.name])}
                              disabled={status === 'loading'}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Adjacent Solutions */}
                {existingResearch.smartSuggestions.filter(s => s.type === 'adjacent_solution' && s.isActualProduct).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Adjacent Solutions
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {existingResearch.smartSuggestions
                        .filter(s => s.type === 'adjacent_solution' && s.isActualProduct && !knownCompetitors.includes(s.name))
                        .map((suggestion) => (
                          <Button
                            key={suggestion.name}
                            variant="outline"
                            size="sm"
                            onClick={() => setKnownCompetitors([...knownCompetitors, suggestion.name])}
                            disabled={status === 'loading'}
                            className="text-xs"
                            title={suggestion.context}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {suggestion.name}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {/* All smart suggestions added */}
                {existingResearch.smartSuggestions
                  .filter(s => s.isActualProduct)
                  .every((s) => knownCompetitors.includes(s.name)) && (
                  <p className="text-sm text-muted-foreground italic">
                    All suggested competitors have been added.
                  </p>
                )}
              </div>
            )}

            {/* Fallback: Raw Suggested Competitors from Community Voice (when no smart suggestions) */}
            {existingResearch &&
             existingResearch.suggestedCompetitors.length > 0 &&
             existingResearch.smartSuggestions.length === 0 && (
              <div className="space-y-2 p-4 bg-muted/30 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-foreground/70" />
                  <Label className="font-medium">
                    Suggested from Community Voice
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  These alternatives were mentioned in Reddit discussions. Click to add:
                </p>
                <div className="flex flex-wrap gap-2">
                  {existingResearch.suggestedCompetitors
                    .filter((comp) => !knownCompetitors.includes(comp))
                    .map((competitor) => (
                      <Button
                        key={competitor}
                        variant="outline"
                        size="sm"
                        onClick={() => setKnownCompetitors([...knownCompetitors, competitor])}
                        disabled={status === 'loading'}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {competitor}
                      </Button>
                    ))}
                </div>
                {existingResearch.suggestedCompetitors.every((comp) =>
                  knownCompetitors.includes(comp)
                ) && (
                  <p className="text-sm text-muted-foreground italic">
                    All suggested competitors have been added.
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={runResearch}
              disabled={loadingExisting || status === 'loading' || !hypothesis.trim()}
              className="w-full"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Competitors...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Run Competitor Analysis
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Loading State */}
        {status === 'loading' && (
          <Card>
            <CardContent className="py-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">Analyzing competitive landscape...</span>
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
          <CompetitorResults results={results} />
        )}
    </div>
  )
}

// Loading fallback component
function CompetitorResearchLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

// Main page component wrapped in Suspense
export default function CompetitorResearchPage() {
  return (
    <Suspense fallback={<CompetitorResearchLoading />}>
      <CompetitorResearchContent />
    </Suspense>
  )
}
