'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertCircle,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Filter,
  Target,
  PieChart,
  Timer,
  Shield,
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { calculateOverallPainScore, PainSummary } from '@/lib/analysis/pain-detector'
import {
  calculateViability,
  PainScoreInput,
  CompetitionScoreInput,
  MarketScoreInput,
  TimingScoreInput,
  ViabilityVerdict,
  VerdictColors,
} from '@/lib/analysis/viability-calculator'

interface ResearchJob {
  id: string
  hypothesis: string
  status: string
  created_at: string
  updated_at: string
  user_id: string
  profiles?: {
    email: string
    full_name: string | null
  }
}

interface ResearchResult {
  id: string
  job_id: string
  module_name: string
  data: CommunityVoiceResult | CompetitorIntelligenceResult
  created_at: string
}

// Helper function to calculate full viability verdict (same logic as user-facing page)
function calculateFullVerdict(
  cvResult: ResearchResult | undefined,
  compResult: ResearchResult | undefined
): ViabilityVerdict | null {
  let painScoreInput: PainScoreInput | null = null
  let competitionScoreInput: CompetitionScoreInput | null = null
  let marketScoreInput: MarketScoreInput | null = null
  let timingScoreInput: TimingScoreInput | null = null

  const cvData = cvResult?.data as CommunityVoiceResult | undefined
  const compData = compResult?.data as CompetitorIntelligenceResult | undefined

  // Extract pain score
  if (cvData?.painSummary) {
    const rawPainSummary = cvData.painSummary
    const painSummary = {
      totalSignals: rawPainSummary.totalSignals || 0,
      averageScore: rawPainSummary.averageScore || 0,
      highIntensityCount: rawPainSummary.highIntensityCount || 0,
      mediumIntensityCount: rawPainSummary.mediumIntensityCount || 0,
      lowIntensityCount: rawPainSummary.lowIntensityCount || 0,
      solutionSeekingCount: rawPainSummary.solutionSeekingCount || 0,
      willingnessToPayCount: rawPainSummary.willingnessToPayCount || 0,
      topSubreddits: rawPainSummary.topSubreddits || [],
      dataConfidence: (rawPainSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'low',
      strongestSignals: (rawPainSummary as { strongestSignals?: string[] }).strongestSignals || [],
      wtpQuotes: (rawPainSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes || [],
      temporalDistribution: (rawPainSummary as { temporalDistribution?: { last30Days: number; last90Days: number; last180Days: number; older: number } }).temporalDistribution || {
        last30Days: 0, last90Days: 0, last180Days: 0, older: rawPainSummary.totalSignals || 0
      },
      dateRange: (rawPainSummary as { dateRange?: { oldest: string; newest: string } }).dateRange,
      recencyScore: (rawPainSummary as { recencyScore?: number }).recencyScore ?? 0.5,
    }

    const painScoreResult = calculateOverallPainScore(painSummary)
    painScoreInput = {
      overallScore: painScoreResult.score,
      confidence: painScoreResult.confidence,
      totalSignals: painSummary.totalSignals,
      willingnessToPayCount: painSummary.willingnessToPayCount,
    }
  }

  // Extract competition score
  if (compData?.competitionScore) {
    competitionScoreInput = {
      score: compData.competitionScore.score,
      confidence: compData.competitionScore.confidence,
      competitorCount: compData.metadata.competitorsAnalyzed,
      threats: compData.competitionScore.threats || [],
    }
  }

  // Extract market sizing
  if (cvData?.marketSizing) {
    marketScoreInput = {
      score: cvData.marketSizing.score,
      confidence: cvData.marketSizing.confidence,
      penetrationRequired: cvData.marketSizing.mscAnalysis.penetrationRequired,
      achievability: cvData.marketSizing.mscAnalysis.achievability,
    }
  }

  // Extract timing
  if (cvData?.timing) {
    timingScoreInput = {
      score: cvData.timing.score,
      confidence: cvData.timing.confidence,
      trend: cvData.timing.trend,
      tailwindsCount: cvData.timing.tailwinds?.length || 0,
      headwindsCount: cvData.timing.headwinds?.length || 0,
      timingWindow: cvData.timing.timingWindow,
    }
  }

  // If we have at least one dimension, calculate verdict
  if (painScoreInput || competitionScoreInput || marketScoreInput || timingScoreInput) {
    return calculateViability(painScoreInput, competitionScoreInput, marketScoreInput, timingScoreInput)
  }

  return null
}

interface JobWithResults extends ResearchJob {
  results: ResearchResult[]
}

export default function AdminDebugPage() {
  const [jobs, setJobs] = useState<JobWithResults[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set())

  // Check if we're in dev mode
  const isDev = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/admin/debug')
        if (!response.ok) {
          throw new Error('Failed to fetch debug data')
        }
        const data = await response.json()
        setJobs(data.jobs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const toggleSignal = (signalId: string) => {
    setExpandedSignals((prev) => {
      const next = new Set(prev)
      if (next.has(signalId)) {
        next.delete(signalId)
      } else {
        next.add(signalId)
      }
      return next
    })
  }

  const exportJobData = (job: JobWithResults) => {
    const dataStr = JSON.stringify(job, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pvre-debug-${job.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredJobs = jobs.filter(
    (job) =>
      job.hypothesis.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id.includes(searchQuery)
  )

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getWtpColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'medium':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      case 'low':
        return 'bg-muted text-muted-foreground'
      default:
        return ''
    }
  }

  const highlightKeywords = (text: string, signals: string[]) => {
    if (!signals || signals.length === 0) return text

    let result = text
    signals.forEach((signal) => {
      const regex = new RegExp(`(${signal})`, 'gi')
      result = result.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>')
    })
    return result
  }

  if (!isDev) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700 dark:text-red-300">Access Denied</h2>
            <p className="text-red-600 dark:text-red-400 mt-2">
              This page is only available in development mode.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Debug Dashboard</h1>
          <p className="text-muted-foreground">
            Inspect raw research data, validate scoring accuracy, and identify issues.
          </p>
          <Badge variant="outline" className="mt-2 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400">
            Development Mode Only
          </Badge>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by hypothesis or job ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{jobs.length}</div>
              <div className="text-sm text-muted-foreground">Total Jobs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  const cvData = cvResult?.data as CommunityVoiceResult | undefined
                  return acc + (cvData?.painSignals?.length || 0)
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Signals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  const cvData = cvResult?.data as CommunityVoiceResult | undefined
                  return (
                    acc +
                    (cvData?.painSignals?.filter((s) => s.willingnessToPaySignal)?.length ||
                      0)
                  )
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">WTP Signals</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {jobs.reduce((acc, job) => {
                  const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
                  const cvData = cvResult?.data as CommunityVoiceResult | undefined
                  return (
                    acc +
                    (cvData?.painSignals?.filter((s) => s.intensity === 'high')?.length || 0)
                  )
                }, 0)}
              </div>
              <div className="text-sm text-muted-foreground">High Intensity</div>
            </CardContent>
          </Card>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p>Loading research data...</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs List */}
        {!loading && !error && (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const isExpanded = expandedJobs.has(job.id)
              const cvResult = job.results?.find((r) => r.module_name === 'community_voice')
              const compResult = job.results?.find((r) => r.module_name === 'competitor_intel')
              const cvData = cvResult?.data as CommunityVoiceResult | undefined
              const painSignals = cvData?.painSignals || []
              const painSummary = cvData?.painSummary

              // Calculate the FULL viability verdict (same as user-facing page)
              const viabilityVerdict = calculateFullVerdict(cvResult, compResult)

              // Get individual dimension scores from the verdict
              const painDim = viabilityVerdict?.dimensions.find(d => d.name === 'Pain Score')
              const marketDim = viabilityVerdict?.dimensions.find(d => d.name === 'Market Score')
              const timingDim = viabilityVerdict?.dimensions.find(d => d.name === 'Timing Score')
              const compDim = viabilityVerdict?.dimensions.find(d => d.name === 'Competition Score')

              // Get verdict color
              const verdictColors = viabilityVerdict
                ? VerdictColors[viabilityVerdict.verdict]
                : null

              return (
                <Card key={job.id} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleJob(job.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 mt-1 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 mt-1 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{job.hypothesis}</CardTitle>
                          <CardDescription className="mt-1">
                            <span className="text-primary font-medium">
                              {job.profiles?.full_name || job.profiles?.email || 'Unknown user'}
                            </span>
                            {' • '}Job ID: {job.id.slice(0, 8)}... | {new Date(job.created_at).toLocaleString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* MAIN: Viability Verdict Score (what users see) */}
                        {viabilityVerdict && (
                          <Badge className={`${verdictColors?.bg} text-white font-bold`}>
                            <Target className="h-3 w-3 mr-1" />
                            Verdict: {viabilityVerdict.overallScore.toFixed(1)}/10
                          </Badge>
                        )}
                        {/* Individual dimension scores */}
                        {painDim && (
                          <Badge variant="outline" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Pain: {painDim.score.toFixed(1)}
                          </Badge>
                        )}
                        {marketDim && (
                          <Badge variant="outline" className="text-xs">
                            <PieChart className="h-3 w-3 mr-1" />
                            Market: {marketDim.score.toFixed(1)}
                          </Badge>
                        )}
                        {timingDim && (
                          <Badge variant="outline" className="text-xs">
                            <Timer className="h-3 w-3 mr-1" />
                            Timing: {timingDim.score.toFixed(1)}
                          </Badge>
                        )}
                        {compDim && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Comp: {compDim.score.toFixed(1)}
                          </Badge>
                        )}
                        {/* Data signals count */}
                        {painSummary && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {painSummary.totalSignals || painSignals.length} signals
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            exportJobData(job)
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="border-t bg-muted/30">
                      <Tabs defaultValue="signals" className="mt-4">
                        <TabsList>
                          <TabsTrigger value="signals">Pain Signals ({painSignals.length})</TabsTrigger>
                          <TabsTrigger value="summary">Summary</TabsTrigger>
                          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                        </TabsList>

                        <TabsContent value="signals" className="mt-4">
                          <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {painSignals.map((signal, idx) => {
                              const signalId = `${job.id}-${idx}`
                              const isSignalExpanded = expandedSignals.has(signalId)

                              return (
                                <div
                                  key={signalId}
                                  className="border rounded-lg bg-card p-4"
                                >
                                  <div
                                    className="flex items-start justify-between cursor-pointer"
                                    onClick={() => toggleSignal(signalId)}
                                  >
                                    <div className="flex items-start gap-3 flex-1">
                                      {isSignalExpanded ? (
                                        <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground" />
                                      )}
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge
                                            className={getIntensityColor(signal.intensity)}
                                          >
                                            {signal.intensity}
                                          </Badge>
                                          <Badge variant="outline">
                                            Score: {signal.score?.toFixed(1)}/10
                                          </Badge>
                                          {signal.willingnessToPaySignal && (
                                            <Badge className={getWtpColor(signal.wtpConfidence || 'low')}>
                                              WTP: {signal.wtpConfidence}
                                            </Badge>
                                          )}
                                          {signal.solutionSeeking && (
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                                              Solution Seeking
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                          {signal.text?.substring(0, 200)}...
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground text-right ml-4">
                                      <div>r/{signal.source?.subreddit}</div>
                                      <div>{signal.source?.type}</div>
                                    </div>
                                  </div>

                                  {isSignalExpanded && (
                                    <div className="mt-4 pt-4 border-t space-y-4">
                                      {/* Full Text */}
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          FULL TEXT (with keyword highlights)
                                        </div>
                                        <div
                                          className="text-sm bg-muted p-3 rounded border max-h-48 overflow-y-auto"
                                          dangerouslySetInnerHTML={{
                                            __html: highlightKeywords(
                                              signal.text || '',
                                              signal.signals || []
                                            ),
                                          }}
                                        />
                                      </div>

                                      {/* Matched Keywords */}
                                      <div>
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          MATCHED KEYWORDS
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {signal.signals?.map((keyword, kidx) => (
                                            <Badge
                                              key={kidx}
                                              variant="outline"
                                              className="bg-yellow-50"
                                            >
                                              {keyword}
                                            </Badge>
                                          ))}
                                          {(!signal.signals || signal.signals.length === 0) && (
                                            <span className="text-sm text-muted-foreground">
                                              No keywords detected
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Score Breakdown */}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2">
                                            SCORE BREAKDOWN
                                          </div>
                                          <div className="text-sm space-y-1">
                                            <div>
                                              Intensity: <strong>{signal.intensity}</strong>
                                            </div>
                                            <div>
                                              Base Score: <strong>{signal.score?.toFixed(2)}</strong>
                                            </div>
                                            <div>
                                              Engagement:{' '}
                                              <strong>{signal.source?.engagementScore || 'N/A'}</strong>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2">
                                            SOURCE
                                          </div>
                                          <div className="text-sm space-y-1">
                                            <div>
                                              Subreddit:{' '}
                                              <strong>r/{signal.source?.subreddit}</strong>
                                            </div>
                                            <div>
                                              Type: <strong>{signal.source?.type}</strong>
                                            </div>
                                            {signal.source?.url && (
                                              <a
                                                href={signal.source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline flex items-center gap-1"
                                              >
                                                View on Reddit
                                                <ExternalLink className="h-3 w-3" />
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {painSignals.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                No pain signals found for this job.
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="summary" className="mt-4">
                          {viabilityVerdict ? (
                            <div className="space-y-6">
                              {/* VIABILITY VERDICT (what users see) */}
                              <Card className={`${verdictColors?.bgLight} ${verdictColors?.border} border-2`}>
                                <CardHeader>
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Target className="h-5 w-5" />
                                    Viability Verdict (User-Facing)
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="flex items-center gap-4 mb-4">
                                    <div className={`text-4xl font-bold ${verdictColors?.text}`}>
                                      {viabilityVerdict.overallScore.toFixed(1)}/10
                                    </div>
                                    <div>
                                      <Badge className={`${verdictColors?.bg} text-white`}>
                                        {viabilityVerdict.verdictLabel}
                                      </Badge>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {viabilityVerdict.availableDimensions}/{viabilityVerdict.totalDimensions} dimensions
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-sm">{viabilityVerdict.verdictDescription}</p>
                                </CardContent>
                              </Card>

                              {/* DIMENSION BREAKDOWN */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-base">Dimension Breakdown (Debug)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-4">
                                    {viabilityVerdict.dimensions.map((dim) => (
                                      <div key={dim.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                        <div className="flex items-center gap-3">
                                          {dim.name === 'Pain Score' && <TrendingUp className="h-4 w-4" />}
                                          {dim.name === 'Market Score' && <PieChart className="h-4 w-4" />}
                                          {dim.name === 'Timing Score' && <Timer className="h-4 w-4" />}
                                          {dim.name === 'Competition Score' && <Shield className="h-4 w-4" />}
                                          <div>
                                            <div className="font-medium">{dim.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                              Weight: {(dim.weight * 100).toFixed(0)}% | {dim.confidence} confidence
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-xl font-bold">{dim.score.toFixed(1)}/10</div>
                                          <Badge variant="outline" className={
                                            dim.status === 'strong' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400' :
                                            dim.status === 'adequate' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                                            dim.status === 'needs_work' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400' :
                                            'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                                          }>
                                            {dim.status.replace('_', ' ')}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>

                              <div className="grid grid-cols-2 gap-6">
                                {/* Signal Distribution */}
                                {painSummary && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Signal Distribution</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span>High Intensity:</span>
                                          <Badge className={getIntensityColor('high')}>
                                            {painSummary.highIntensityCount}
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Medium Intensity:</span>
                                          <Badge className={getIntensityColor('medium')}>
                                            {painSummary.mediumIntensityCount}
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Low Intensity:</span>
                                          <Badge className={getIntensityColor('low')}>
                                            {painSummary.lowIntensityCount}
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t">
                                          <span>WTP Count:</span>
                                          <strong>{painSummary.willingnessToPayCount}</strong>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Solution Seeking:</span>
                                          <strong>{painSummary.solutionSeekingCount}</strong>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                )}

                                {/* Raw Data Debug */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Raw Data (Debug)</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2 text-sm">
                                      {painSummary && (
                                        <>
                                          <div className="flex justify-between">
                                            <span>Raw Pain Avg:</span>
                                            <code className="bg-muted px-1 rounded">{painSummary.averageScore?.toFixed(2)}</code>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Total Signals:</span>
                                            <code className="bg-muted px-1 rounded">{painSummary.totalSignals}</code>
                                          </div>
                                        </>
                                      )}
                                      {cvData?.marketSizing && (
                                        <div className="flex justify-between">
                                          <span>Market Raw:</span>
                                          <code className="bg-muted px-1 rounded">{cvData.marketSizing.score.toFixed(2)}</code>
                                        </div>
                                      )}
                                      {cvData?.timing && (
                                        <div className="flex justify-between">
                                          <span>Timing Raw:</span>
                                          <code className="bg-muted px-1 rounded">{cvData.timing.score.toFixed(2)}</code>
                                        </div>
                                      )}
                                      {(compResult?.data as CompetitorIntelligenceResult | undefined)?.competitionScore && (
                                        <div className="flex justify-between">
                                          <span>Competition Raw:</span>
                                          <code className="bg-muted px-1 rounded">
                                            {(compResult?.data as CompetitorIntelligenceResult).competitionScore.score.toFixed(2)}
                                          </code>
                                        </div>
                                      )}
                                      {viabilityVerdict.dealbreakers.length > 0 && (
                                        <div className="pt-2 border-t">
                                          <div className="text-red-600 font-medium">Dealbreakers:</div>
                                          {viabilityVerdict.dealbreakers.map((d, i) => (
                                            <div key={i} className="text-red-600 text-xs">• {d}</div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No verdict data available.
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="raw" className="mt-4">
                          {/* Clarify the difference between raw scores and calculated verdict */}
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                            <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">Note: Raw JSON vs Calculated Verdict</p>
                            <p className="text-blue-700 dark:text-blue-300">
                              The raw JSON contains individual dimension scores (Pain, Market, Timing).
                              The <strong>Viability Verdict</strong> shown in Summary tab is dynamically calculated
                              using weighted averages of all available dimensions including Competition (if run).
                              {viabilityVerdict && (
                                <span className="block mt-1">
                                  Current calculated verdict: <strong>{viabilityVerdict.overallScore.toFixed(1)}/10</strong> ({viabilityVerdict.availableDimensions}/{viabilityVerdict.totalDimensions} dimensions)
                                </span>
                              )}
                            </p>
                          </div>
                          <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-auto max-h-[500px] text-xs">
                            {JSON.stringify(cvResult?.data, null, 2)}
                          </pre>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  )}
                </Card>
              )
            })}

            {filteredJobs.length === 0 && !loading && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No research jobs found matching your search.
                </CardContent>
              </Card>
            )}
          </div>
        )}
    </div>
  )
}
