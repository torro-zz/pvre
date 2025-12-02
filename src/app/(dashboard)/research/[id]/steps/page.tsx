'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { StepProgress, getNextPendingStep, getStepLabel, isAllStepsCompleted } from '@/components/research/step-progress'
import { StepStatusMap, StepStatus } from '@/types/database'
import { Loader2, Play, CheckCircle2, AlertCircle, ArrowRight, Plus, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PDFDownloadButton } from '@/components/research/pdf-download-button'
import { calculateViability, PainScoreInput, CompetitionScoreInput, MarketScoreInput, TimingScoreInput } from '@/lib/analysis/viability-calculator'

interface ResearchJob {
  id: string
  hypothesis: string
  status: string
  step_status: StepStatusMap | null
  created_at: string
}

interface StepResult {
  module_name: string
  data: Record<string, unknown>
}

export default function ResearchStepsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [job, setJob] = useState<ResearchJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<keyof StepStatusMap>('pain_analysis')
  const [stepResults, setStepResults] = useState<Map<string, StepResult>>(new Map())
  const [runningStep, setRunningStep] = useState<keyof StepStatusMap | null>(null)
  const [stepProgress, setStepProgress] = useState<{ message: string; progress: number }>({ message: '', progress: 0 })
  const abortControllerRef = useRef<AbortController | null>(null)

  // Market sizing options
  const [marketRegion, setMarketRegion] = useState<string>('Global')
  const [targetPrice, setTargetPrice] = useState<string>('29')

  // Competitor selection
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([])
  const [competitorInput, setCompetitorInput] = useState<string>('')
  const [competitorSuggestions, setCompetitorSuggestions] = useState<Array<{ name: string; type: string }>>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Fetch job data
  useEffect(() => {
    async function fetchJob() {
      try {
        const response = await fetch(`/api/research/jobs?id=${resolvedParams.id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch job')
        }
        const data = await response.json()
        setJob(data)

        // Determine current step based on step_status
        const nextStep = getNextPendingStep(data.step_status)
        if (nextStep) {
          setCurrentStep(nextStep)
        } else if (isAllStepsCompleted(data.step_status)) {
          setCurrentStep('competitor_analysis') // Show last step if all done
        }

        // Fetch results for completed steps
        await fetchStepResults(data.step_status)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load research')
      } finally {
        setLoading(false)
      }
    }
    fetchJob()
  }, [resolvedParams.id])

  // Fetch results for completed steps
  async function fetchStepResults(stepStatus: StepStatusMap | null) {
    if (!stepStatus) return

    const moduleMap: Record<keyof StepStatusMap, string> = {
      pain_analysis: 'pain_analysis',
      market_sizing: 'market_sizing',
      timing_analysis: 'timing_analysis',
      competitor_analysis: 'competitor_intelligence',
    }

    const results = new Map<string, StepResult>()

    for (const [step, status] of Object.entries(stepStatus)) {
      if (status === 'completed') {
        try {
          const response = await fetch(
            `/api/research/results?jobId=${resolvedParams.id}&moduleType=${moduleMap[step as keyof StepStatusMap]}`
          )
          if (response.ok) {
            const data = await response.json()
            results.set(step, data)
          }
        } catch (err) {
          console.error(`Failed to fetch results for ${step}:`, err)
        }
      }
    }

    setStepResults(results)
  }

  // Fetch competitor suggestions from pain analysis
  async function fetchCompetitorSuggestions() {
    if (!job || loadingSuggestions) return

    setLoadingSuggestions(true)
    try {
      const response = await fetch(`/api/research/competitor-suggestions?jobId=${job.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setCompetitorSuggestions(data.suggestions)
        }
      }
    } catch (err) {
      console.error('Failed to fetch competitor suggestions:', err)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Add a competitor to selection
  function addCompetitor(name: string) {
    if (name.trim() && !selectedCompetitors.includes(name.trim())) {
      setSelectedCompetitors([...selectedCompetitors, name.trim()])
    }
  }

  // Remove a competitor from selection
  function removeCompetitor(name: string) {
    setSelectedCompetitors(selectedCompetitors.filter(c => c !== name))
  }

  // Run a step
  async function runStep(step: keyof StepStatusMap) {
    if (!job) return

    setRunningStep(step)
    setStepProgress({ message: 'Starting...', progress: 0 })
    setError(null)

    try {
      abortControllerRef.current = new AbortController()

      let endpoint: string
      let method = 'POST'
      let useStream = false

      switch (step) {
        case 'pain_analysis':
          endpoint = '/api/research/pain-analysis/stream'
          useStream = true
          break
        case 'market_sizing':
          endpoint = '/api/research/market-sizing'
          break
        case 'timing_analysis':
          endpoint = '/api/research/timing'
          break
        case 'competitor_analysis':
          endpoint = '/api/research/competitor-intelligence'
          break
        default:
          throw new Error('Unknown step')
      }

      if (useStream) {
        // Handle streaming response
        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hypothesis: job.hypothesis, jobId: job.id }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to start analysis')
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                if (event.type === 'progress') {
                  setStepProgress({
                    message: event.message,
                    progress: Math.min(90, stepProgress.progress + 10),
                  })
                } else if (event.type === 'complete') {
                  setStepProgress({ message: 'Complete!', progress: 100 })
                } else if (event.type === 'error') {
                  throw new Error(event.message)
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } else {
        // Handle regular response
        setStepProgress({ message: 'Running analysis...', progress: 50 })

        // Build request body based on step type
        let requestBody: Record<string, unknown> = {
          hypothesis: job.hypothesis,
          jobId: job.id,
        }

        if (step === 'market_sizing') {
          requestBody.geography = marketRegion
          requestBody.targetPrice = parseFloat(targetPrice) || 29
        }

        if (step === 'competitor_analysis' && selectedCompetitors.length > 0) {
          requestBody.competitors = selectedCompetitors
        }

        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Analysis failed')
        }

        setStepProgress({ message: 'Complete!', progress: 100 })
      }

      // Refresh job data to get updated step_status
      const jobResponse = await fetch(`/api/research/jobs?id=${resolvedParams.id}`)
      if (jobResponse.ok) {
        const updatedJob = await jobResponse.json()
        setJob(updatedJob)

        // Fetch results for the completed step
        await fetchStepResults(updatedJob.step_status)

        // Move to next step
        const nextStep = getNextPendingStep(updatedJob.step_status)
        if (nextStep) {
          setCurrentStep(nextStep)
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // User cancelled
      }
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setRunningStep(null)
      setStepProgress({ message: '', progress: 0 })
    }
  }

  // Render step content
  function renderStepContent() {
    if (!job) return null

    const stepStatus = job.step_status?.[currentStep] || 'pending'
    const result = stepResults.get(currentStep)

    if (stepStatus === 'locked') {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            Complete the previous steps to unlock {getStepLabel(currentStep)}.
          </p>
        </div>
      )
    }

    if (runningStep === currentStep) {
      return (
        <div className="space-y-4 py-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">{stepProgress.message || 'Processing...'}</span>
          </div>
          <Progress value={stepProgress.progress} className="h-2" />
          <div className="pt-4 space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-32" />
          </div>
        </div>
      )
    }

    if (stepStatus === 'completed' && result) {
      return renderStepResults(currentStep, result)
    }

    if (stepStatus === 'failed') {
      return (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-destructive mb-4">This step failed. Please try again.</p>
          <Button onClick={() => runStep(currentStep)}>
            <Play className="h-4 w-4 mr-2" />
            Retry {getStepLabel(currentStep)}
          </Button>
        </div>
      )
    }

    // Pending - show run button with optional inputs
    if (currentStep === 'market_sizing') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="region">Target Region</Label>
              <Select value={marketRegion} onValueChange={setMarketRegion}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="North America">North America</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="Asia-Pacific">Asia-Pacific</SelectItem>
                  <SelectItem value="Latin America">Latin America</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The geographic market for your TAM/SAM/SOM calculation
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Target Monthly Price ($)</Label>
              <Input
                id="price"
                type="number"
                min="1"
                max="10000"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="29"
              />
              <p className="text-xs text-muted-foreground">
                Your expected monthly subscription price
              </p>
            </div>
          </div>
          <div className="text-center pt-4">
            <Button size="lg" onClick={() => runStep(currentStep)}>
              <Play className="h-4 w-4 mr-2" />
              Run Market Sizing
            </Button>
          </div>
        </div>
      )
    }

    if (currentStep === 'competitor_analysis') {
      // Auto-fetch suggestions when reaching this step
      if (competitorSuggestions.length === 0 && !loadingSuggestions) {
        fetchCompetitorSuggestions()
      }

      return (
        <div className="space-y-6">
          {/* Selected Competitors */}
          {selectedCompetitors.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Competitors ({selectedCompetitors.length})</Label>
              <div className="flex flex-wrap gap-2">
                {selectedCompetitors.map((name) => (
                  <Badge key={name} variant="secondary" className="pl-3 pr-1 py-1.5">
                    {name}
                    <button
                      onClick={() => removeCompetitor(name)}
                      className="ml-2 hover:bg-muted rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <div className="space-y-2">
            <Label>AI-Suggested Competitors</Label>
            {loadingSuggestions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading suggestions from your research...
              </div>
            ) : competitorSuggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {competitorSuggestions
                  .filter((s) => !selectedCompetitors.includes(s.name))
                  .map((suggestion) => (
                    <Button
                      key={suggestion.name}
                      variant="outline"
                      size="sm"
                      onClick={() => addCompetitor(suggestion.name)}
                      className="h-auto py-1"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {suggestion.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({suggestion.type})
                      </span>
                    </Button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No suggestions available. Add competitors manually below.
              </p>
            )}
          </div>

          {/* Manual Input */}
          <div className="space-y-2">
            <Label htmlFor="competitor-input">Add Competitor Manually</Label>
            <div className="flex gap-2">
              <Input
                id="competitor-input"
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                placeholder="Enter competitor name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addCompetitor(competitorInput)
                    setCompetitorInput('')
                  }
                }}
              />
              <Button
                variant="outline"
                onClick={() => {
                  addCompetitor(competitorInput)
                  setCompetitorInput('')
                }}
                disabled={!competitorInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-center pt-4">
            <Button size="lg" onClick={() => runStep(currentStep)}>
              <Play className="h-4 w-4 mr-2" />
              Run Competitor Analysis
              {selectedCompetitors.length > 0 && (
                <span className="ml-1">({selectedCompetitors.length} selected)</span>
              )}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-6">
          Ready to run {getStepLabel(currentStep).toLowerCase()}.
        </p>
        <Button size="lg" onClick={() => runStep(currentStep)}>
          <Play className="h-4 w-4 mr-2" />
          Run {getStepLabel(currentStep)}
        </Button>
      </div>
    )
  }

  // Render results for a completed step
  function renderStepResults(step: keyof StepStatusMap, result: StepResult) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any

    switch (step) {
      case 'pain_analysis':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Pain Signals</p>
                  <p className="text-2xl font-bold">{data.painSignals?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Themes</p>
                  <p className="text-2xl font-bold">{data.themeAnalysis?.themes?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Posts Analyzed</p>
                  <p className="text-2xl font-bold">{data.metadata?.postsAnalyzed || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Pain Score</p>
                  <p className="text-2xl font-bold">{data.painSummary?.overallScore?.toFixed(1) || 'N/A'}</p>
                </CardContent>
              </Card>
            </div>
            {data.themeAnalysis?.themes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Key Themes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.themeAnalysis.themes.slice(0, 5).map((theme: { name: string; summary: string }, i: number) => (
                      <div key={i} className="border-b pb-3 last:border-0">
                        <p className="font-medium">{theme.name}</p>
                        <p className="text-sm text-muted-foreground">{theme.summary}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 'market_sizing':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">TAM</p>
                  <p className="text-xl font-bold">{data.tam?.displayValue || 'N/A'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">SAM</p>
                  <p className="text-xl font-bold">{data.sam?.displayValue || 'N/A'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">SOM</p>
                  <p className="text-xl font-bold">{data.som?.displayValue || 'N/A'}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Market Score</p>
                <p className="text-3xl font-bold">{data.score || 0}/10</p>
                <p className="text-sm text-muted-foreground mt-2">{data.reasoning}</p>
              </CardContent>
            </Card>
          </div>
        )

      case 'timing_analysis':
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Timing Score</p>
                <p className="text-3xl font-bold">{data.score || 0}/10</p>
                <p className="text-sm text-muted-foreground mt-2">{data.summary}</p>
              </CardContent>
            </Card>
            {data.tailwinds && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-green-600">Tailwinds</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.tailwinds.slice(0, 5).map((item: { factor: string }, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{item.factor}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {data.headwinds && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-amber-600">Headwinds</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {data.headwinds.slice(0, 5).map((item: { factor: string }, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{item.factor}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 'competitor_analysis':
        return (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Competition Score</p>
                <p className="text-3xl font-bold">{data.competitionScore?.score || 0}/10</p>
                <p className="text-sm text-muted-foreground mt-2">{data.competitionScore?.reasoning}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Competitors ({data.competitors?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.competitors?.slice(0, 5).map((competitor: { name: string; description: string; threatLevel: string }, i: number) => (
                    <div key={i} className="border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{competitor.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          competitor.threatLevel === 'high' ? 'bg-red-100 text-red-700' :
                          competitor.threatLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {competitor.threatLevel} threat
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{competitor.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return <p>Results available</p>
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Skeleton className="h-16 w-full mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Research not found'}</AlertDescription>
        </Alert>
        <Button className="mt-4" variant="outline" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const allCompleted = isAllStepsCompleted(job.step_status)

  // Build report data for PDF export
  function buildReportData() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const painData = stepResults.get('pain_analysis')?.data as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const marketData = stepResults.get('market_sizing')?.data as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timingData = stepResults.get('timing_analysis')?.data as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitorData = stepResults.get('competitor_analysis')?.data as any

    // Calculate viability from step results
    const painInput: PainScoreInput | undefined = painData?.painSummary ? {
      overallScore: painData.painSummary.overallScore || 0,
      confidence: painData.painSummary.confidence || 'low',
      totalSignals: painData.painSignals?.length || 0,
      willingnessToPayCount: painData.painSummary.willingnessSignals || 0,
    } : undefined

    const marketInput: MarketScoreInput | undefined = marketData ? {
      score: marketData.score || 0,
      confidence: marketData.confidence || 'low',
      penetrationRequired: marketData.msc?.penetrationRequired || 0,
      achievability: marketData.msc?.achievability || 'challenging',
    } : undefined

    const timingInput: TimingScoreInput | undefined = timingData ? {
      score: timingData.score || 0,
      confidence: timingData.confidence || 'low',
      trend: timingData.trendDirection || 'stable',
      tailwindsCount: timingData.tailwinds?.length || 0,
      headwindsCount: timingData.headwinds?.length || 0,
      timingWindow: timingData.timingWindow || 'Now',
    } : undefined

    const competitionInput: CompetitionScoreInput | undefined = competitorData?.competitionScore ? {
      score: competitorData.competitionScore.score || 0,
      confidence: competitorData.competitionScore.confidence || 'low',
      competitorCount: competitorData.competitors?.length || 0,
      threats: competitorData.competitors?.filter((c: { threatLevel: string }) => c.threatLevel === 'high').map((c: { name: string }) => c.name) || [],
    } : undefined

    const viabilityVerdict = calculateViability(
      painInput || null,
      competitionInput || null,
      marketInput || null,
      timingInput || null
    )

    // Build community voice result format for PDF
    const communityVoiceResult = painData ? {
      ...painData,
      marketSizing: marketData,
      timing: timingData,
    } : undefined

    return {
      hypothesis: job?.hypothesis || '',
      createdAt: job ? new Date(job.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }) : '',
      viability: viabilityVerdict,
      communityVoice: communityVoiceResult,
      competitors: competitorData,
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Research Steps</h1>
        <p className="text-muted-foreground line-clamp-2">{job.hypothesis}</p>
      </div>

      {/* Step Progress */}
      <Card className="mb-8">
        <CardContent className="py-6">
          <StepProgress
            stepStatus={job.step_status}
            currentStep={currentStep}
            onStepClick={(step) => {
              const status = job.step_status?.[step]
              if (status !== 'locked') {
                setCurrentStep(step)
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{getStepLabel(currentStep)}</span>
            {job.step_status?.[currentStep] === 'completed' && (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
          </CardTitle>
          <CardDescription>
            {currentStep === 'pain_analysis' && 'Analyze community discussions to identify pain points and themes.'}
            {currentStep === 'market_sizing' && 'Estimate the total addressable market for your idea.'}
            {currentStep === 'timing_analysis' && 'Evaluate market timing and trends.'}
            {currentStep === 'competitor_analysis' && 'Analyze the competitive landscape.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard')}
        >
          Back to Dashboard
        </Button>

        {allCompleted && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/research/${job.id}`)}
            >
              View Full Results
            </Button>
            <PDFDownloadButton reportData={buildReportData()} />
          </div>
        )}

        {!allCompleted && job.step_status?.[currentStep] === 'completed' && (
          <Button
            onClick={() => {
              const nextStep = getNextPendingStep(job.step_status)
              if (nextStep) {
                setCurrentStep(nextStep)
              }
            }}
          >
            Continue to Next Step
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
