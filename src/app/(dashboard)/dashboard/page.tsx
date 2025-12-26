import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, FileText, CheckCircle2, Loader2, TrendingUp, Target, Hourglass, Users, Play, RefreshCw, Sparkles } from 'lucide-react'
import { StepStatusMap, DEFAULT_STEP_STATUS } from '@/types/database'
import { ResearchJobList, ResearchJobWithVerdict } from '@/components/dashboard/research-job-list'
import { QuickStats } from '@/components/dashboard/quick-stats'
import { OverviewCharts } from '@/components/dashboard/overview-charts'
import { TopPerformers } from '@/components/dashboard/top-performers'
import {
  DashboardHeader,
  AnimatedGrid,
  AnimatedItem,
  ProgressBanner,
  FeatureGrid,
  FeatureItem,
} from '@/components/dashboard/animated-dashboard'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'
import { calculateViability, type VerdictLevel } from '@/lib/analysis/viability-calculator'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  step_status: StepStatusMap | null
  created_at: string
  updated_at: string
}

interface RawResult {
  job_id: string
  module_name: string
  data: Record<string, unknown>
}

// Get the next incomplete step for a job
function getNextIncompleteStep(stepStatus: StepStatusMap | null): {
  step: keyof StepStatusMap | null
  label: string
  icon: React.ReactNode
} | null {
  const status = stepStatus || DEFAULT_STEP_STATUS

  const steps: Array<{
    key: keyof StepStatusMap
    label: string
    icon: React.ReactNode
  }> = [
    { key: 'pain_analysis', label: 'Pain Analysis', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'market_sizing', label: 'Market Sizing', icon: <Target className="h-4 w-4" /> },
    { key: 'timing_analysis', label: 'Timing Analysis', icon: <Hourglass className="h-4 w-4" /> },
    { key: 'competitor_analysis', label: 'Competitor Analysis', icon: <Users className="h-4 w-4" /> },
  ]

  for (const step of steps) {
    const stepState = status[step.key]
    if (stepState === 'pending' || stepState === 'in_progress' || stepState === 'failed') {
      return { step: step.key, label: step.label, icon: step.icon }
    }
  }

  // All steps completed
  return null
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user's research jobs
  const { data: jobs } = await supabase
    .from('research_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const researchJobs = (jobs || []) as ResearchJob[]

  // Fetch research results for completed jobs to get verdict data
  const completedJobIds = researchJobs
    .filter(j => j.status === 'completed')
    .map(j => j.id)

  let resultsMap = new Map<string, RawResult[]>()

  if (completedJobIds.length > 0) {
    const { data: results } = await supabase
      .from('research_results')
      .select('job_id, module_name, data')
      .in('job_id', completedJobIds)

    if (results) {
      for (const r of results as RawResult[]) {
        if (!resultsMap.has(r.job_id)) {
          resultsMap.set(r.job_id, [])
        }
        resultsMap.get(r.job_id)!.push(r)
      }
    }
  }

  // Calculate verdicts for each job
  const jobsWithVerdicts: ResearchJobWithVerdict[] = researchJobs.map(job => {
    if (job.status !== 'completed') {
      return { ...job, verdictData: null }
    }

    const jobResults = resultsMap.get(job.id) || []
    const communityVoice = jobResults.find(r =>
      r.module_name === 'community_voice' || r.module_name === 'pain_analysis'
    )
    const competitor = jobResults.find(r =>
      r.module_name === 'competitor_intel' || r.module_name === 'competitor_intelligence'
    )

    // Extract pain score
    let painScoreInput = null
    const painSummary = communityVoice?.data?.painSummary as Record<string, unknown> | undefined
    if (painSummary) {
      const painResult = calculateOverallPainScore({
        totalSignals: (painSummary.totalSignals as number) || 0,
        averageScore: (painSummary.averageScore as number) || 0,
        highIntensityCount: (painSummary.highIntensityCount as number) || 0,
        mediumIntensityCount: (painSummary.mediumIntensityCount as number) || 0,
        lowIntensityCount: (painSummary.lowIntensityCount as number) || 0,
        solutionSeekingCount: (painSummary.solutionSeekingCount as number) || 0,
        willingnessToPayCount: (painSummary.willingnessToPayCount as number) || 0,
        topSubreddits: [],
        dataConfidence: 'medium',
        strongestSignals: [],
        wtpQuotes: [],
        temporalDistribution: { last30Days: 0, last90Days: 0, last180Days: 0, older: 0 },
        recencyScore: 0.5,
      })
      painScoreInput = {
        overallScore: painResult.score,
        confidence: painResult.confidence,
        totalSignals: (painSummary.totalSignals as number) || 0,
        willingnessToPayCount: (painSummary.willingnessToPayCount as number) || 0,
      }
    }

    // Extract competition score
    let competitionScoreInput = null
    const compScore = competitor?.data?.competitionScore as Record<string, unknown> | undefined
    if (compScore) {
      competitionScoreInput = {
        score: (compScore.score as number) || 0,
        confidence: (compScore.confidence as 'low' | 'medium' | 'high') || 'low',
        competitorCount: ((competitor?.data?.metadata as Record<string, unknown>)?.competitorsAnalyzed as number) || 0,
        threats: [],
      }
    }

    // Extract market score
    let marketScoreInput = null
    const marketSizing = communityVoice?.data?.marketSizing as Record<string, unknown> | undefined
    if (marketSizing) {
      const mscAnalysis = marketSizing.mscAnalysis as Record<string, unknown> | undefined
      const achievabilityValue = (mscAnalysis?.achievability as string) || 'achievable'
      const validAchievability = ['highly_achievable', 'achievable', 'challenging', 'difficult', 'unlikely'].includes(achievabilityValue)
        ? achievabilityValue as 'highly_achievable' | 'achievable' | 'challenging' | 'difficult' | 'unlikely'
        : 'achievable'
      marketScoreInput = {
        score: (marketSizing.score as number) || 0,
        confidence: (marketSizing.confidence as 'low' | 'medium' | 'high') || 'low',
        penetrationRequired: (mscAnalysis?.penetrationRequired as number) || 0,
        achievability: validAchievability,
      }
    }

    // Extract timing score
    let timingScoreInput = null
    const timing = communityVoice?.data?.timing as Record<string, unknown> | undefined
    if (timing) {
      timingScoreInput = {
        score: (timing.score as number) || 0,
        confidence: (timing.confidence as 'low' | 'medium' | 'high') || 'low',
        trend: (timing.trend as 'rising' | 'stable' | 'falling') || 'stable',
        tailwindsCount: ((timing.tailwinds as unknown[])?.length as number) || 0,
        headwindsCount: ((timing.headwinds as unknown[])?.length as number) || 0,
        timingWindow: (timing.timingWindow as string) || '',
      }
    }

    // Calculate viability if we have any data
    if (painScoreInput || competitionScoreInput) {
      const viability = calculateViability(
        painScoreInput,
        competitionScoreInput,
        marketScoreInput,
        timingScoreInput
      )

      return {
        ...job,
        verdictData: {
          overallScore: viability.overallScore,
          verdict: viability.verdict,
          painScore: painScoreInput?.overallScore || null,
          marketScore: marketScoreInput?.score || null,
          timingScore: timingScoreInput?.score || null,
        }
      }
    }

    return { ...job, verdictData: null }
  })

  // Find any currently processing jobs (for the "In Progress" banner)
  const STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
  const now = Date.now()

  const processingJobs = jobsWithVerdicts.filter(job => {
    if (job.status !== 'processing') return false
    const updatedAt = new Date(job.updated_at).getTime()
    return (now - updatedAt) < STALE_THRESHOLD_MS
  })

  // Find the most recent job that has incomplete steps
  const incompleteJob = jobsWithVerdicts.find(job => {
    if (job.status === 'failed') return false
    const nextStep = getNextIncompleteStep(job.step_status)
    return nextStep !== null
  })

  const nextStep = incompleteJob ? getNextIncompleteStep(incompleteJob.step_status) : null

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header with greeting */}
      <DashboardHeader
        title={<>Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!</>}
        subtitle="Get automated market research for your business hypothesis"
      />

      {/* In Progress Research Banner */}
      {processingJobs.length > 0 && (
        <ProgressBanner>
          <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-500/10">
            <CardContent className="py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/20 flex-shrink-0">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-blue-900 dark:text-blue-100 text-sm sm:text-base">
                      Research in progress
                    </p>
                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 truncate">
                      "{truncateText(processingJobs[0].hypothesis, 50)}"
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-11 sm:ml-0">
                  <Link href={`/research/${processingJobs[0].id}`}>
                    <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 text-xs sm:text-sm">
                      View Progress
                      <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button size="sm" variant="ghost" className="text-blue-700 dark:text-blue-300 p-2" title="Refresh">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </ProgressBanner>
      )}

      {/* Quick Stats Row */}
      <QuickStats jobs={jobsWithVerdicts} />

      {/* Overview Charts */}
      <OverviewCharts jobs={jobsWithVerdicts} />

      {/* Top Performers Leaderboard */}
      {(() => {
        const topPerformers = jobsWithVerdicts
          .filter(job => job.status === 'completed' && job.verdictData?.overallScore)
          .map(job => ({
            id: job.id,
            hypothesis: job.hypothesis,
            score: job.verdictData!.overallScore,
            verdict: job.verdictData!.verdict,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)

        return topPerformers.length > 0 ? (
          <TopPerformers performers={topPerformers} />
        ) : null
      })()}

      {/* Action Cards */}
      <AnimatedGrid className="md:grid-cols-2">
        {/* Hero: Start New Research */}
        <AnimatedItem>
          <Card className="relative overflow-hidden h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
            <CardHeader className="relative pb-3 sm:pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <CardTitle className="text-base sm:text-lg">Start New Research</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Validate your business hypothesis with AI-powered analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-3 sm:space-y-4">
              <FeatureGrid>
                <FeatureItem>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <div className="p-1 sm:p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20">
                      <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-muted-foreground">Pain Score</span>
                  </div>
                </FeatureItem>
                <FeatureItem>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <div className="p-1 sm:p-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20">
                      <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-muted-foreground">Market Size</span>
                  </div>
                </FeatureItem>
                <FeatureItem>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <div className="p-1 sm:p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20">
                      <Hourglass className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-muted-foreground">Timing</span>
                  </div>
                </FeatureItem>
                <FeatureItem>
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <div className="p-1 sm:p-1.5 rounded-md bg-purple-100 dark:bg-purple-500/20">
                      <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-muted-foreground">Competition</span>
                  </div>
                </FeatureItem>
              </FeatureGrid>
              <Link href="/research">
                <Button className="w-full text-sm sm:text-base" size="lg">
                  Start Research
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </AnimatedItem>

        {/* Continue Your Research (only if incomplete job) */}
        {incompleteJob && nextStep && (
          <AnimatedItem>
            <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 h-full">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Play className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <CardTitle className="text-base sm:text-lg">Continue Your Research</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Next step: <span className="font-medium text-foreground">{nextStep.label}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium line-clamp-2">
                  "{truncateText(incompleteJob.hypothesis, 80)}"
                </p>
                <Link href={`/research/${incompleteJob.id}`} className="block">
                  <Button className="w-full text-sm sm:text-base" variant="default">
                    {nextStep.icon}
                    <span className="ml-2">Continue to {nextStep.label}</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedItem>
        )}

        {/* If no incomplete job, show a placeholder or tips card */}
        {!incompleteJob && (
          <AnimatedItem>
            <Card className="h-full">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <CardTitle className="text-base sm:text-lg">Research Tips</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Get the most out of your research
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                  <span>Be specific about your target audience</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                  <span>Include the problem you're solving</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                  <span>Run competitor analysis for full insights</span>
                </div>
              </CardContent>
            </Card>
          </AnimatedItem>
        )}
      </AnimatedGrid>

      {/* Recent Research */}
      <AnimatedItem>
        <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  Recent Research
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Your latest research projects
                </CardDescription>
              </div>
              {jobsWithVerdicts.length > 0 && (
                <Link href="/account/usage">
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                    View All
                    <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResearchJobList jobs={jobsWithVerdicts} />
          </CardContent>
        </Card>
      </AnimatedItem>
    </div>
  )
}
