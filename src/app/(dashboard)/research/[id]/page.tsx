import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { CompetitorResults } from '@/components/research/competitor-results'
import { ViabilityVerdictDisplay } from '@/components/research/viability-verdict'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, AlertCircle, TrendingUp, Shield, Target } from 'lucide-react'
import { ResearchProgress } from '@/components/research/research-progress'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import {
  calculateMVPViability,
  PainScoreInput,
  CompetitionScoreInput,
} from '@/lib/analysis/viability-calculator'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  user_id: string
}

interface ResearchResult<T = CommunityVoiceResult | CompetitorIntelligenceResult> {
  id: string
  job_id: string
  module_name: string
  data: T
  created_at: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch the research job
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const researchJob = job as ResearchJob

  // Verify user owns this job
  if (researchJob.user_id !== user.id) {
    notFound()
  }

  // Fetch all research results for this job
  const { data: allResults, error: resultsError } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', id)

  console.log('Fetching results for job:', id)
  console.log('All results:', allResults?.length || 0, 'found')
  console.log('Results error:', resultsError?.message || 'None')

  // Extract community voice and competitor results
  const communityVoiceResult = allResults?.find(
    (r) => r.module_name === 'community_voice'
  ) as ResearchResult<CommunityVoiceResult> | undefined

  const competitorResult = allResults?.find(
    (r) => r.module_name === 'competitor_intel'
  ) as ResearchResult<CompetitorIntelligenceResult> | undefined

  // Calculate viability score if we have at least one result
  let painScoreInput: PainScoreInput | null = null
  let competitionScoreInput: CompetitionScoreInput | null = null

  if (communityVoiceResult?.data?.painSummary) {
    const rawPainSummary = communityVoiceResult.data.painSummary

    // Create a complete PainSummary with defaults for backward compatibility
    const painSummary = {
      totalSignals: rawPainSummary.totalSignals || 0,
      averageScore: rawPainSummary.averageScore || 0,
      highIntensityCount: rawPainSummary.highIntensityCount || 0,
      mediumIntensityCount: rawPainSummary.mediumIntensityCount || 0,
      lowIntensityCount: rawPainSummary.lowIntensityCount || 0,
      solutionSeekingCount: rawPainSummary.solutionSeekingCount || 0,
      willingnessToPayCount: rawPainSummary.willingnessToPayCount || 0,
      topSubreddits: rawPainSummary.topSubreddits || [],
      // New fields with defaults for old data
      dataConfidence: (rawPainSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'low',
      strongestSignals: (rawPainSummary as { strongestSignals?: string[] }).strongestSignals || [],
      wtpQuotes: (rawPainSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes || [],
    }

    // Calculate the overall pain score using the enhanced calculator
    const painScoreResult = calculateOverallPainScore(painSummary)

    painScoreInput = {
      overallScore: painScoreResult.score,
      confidence: painScoreResult.confidence,
      totalSignals: painSummary.totalSignals,
      willingnessToPayCount: painSummary.willingnessToPayCount,
    }
  }

  if (competitorResult?.data?.competitionScore) {
    const compScore = competitorResult.data.competitionScore
    competitionScoreInput = {
      score: compScore.score,
      confidence: compScore.confidence,
      competitorCount: competitorResult.data.metadata.competitorsAnalyzed,
      threats: compScore.threats || [],
    }
  }

  const viabilityVerdict = calculateMVPViability(painScoreInput, competitionScoreInput)

  // For backwards compatibility
  const result = communityVoiceResult

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button and header */}
      <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{researchJob.hypothesis}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(researchJob.created_at)}
                </span>
                {result?.data?.metadata?.processingTimeMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {(result.data.metadata.processingTimeMs / 1000).toFixed(1)}s processing
                  </span>
                )}
              </div>
            </div>
            <Badge
              className={
                researchJob.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : researchJob.status === 'processing'
                  ? 'bg-blue-100 text-blue-700'
                  : researchJob.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }
            >
              {researchJob.status.charAt(0).toUpperCase() + researchJob.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Results or status message */}
        {researchJob.status === 'processing' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research in Progress</h3>
                <p className="text-muted-foreground">
                  Your research is still being processed. Please check back in a few moments.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : researchJob.status === 'failed' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Failed</h3>
                <p className="text-muted-foreground mb-4">
                  Unfortunately, the research process encountered an error.
                </p>
                <Link href="/research">
                  <Button>Try Again</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : researchJob.status === 'pending' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Pending</h3>
                <p className="text-muted-foreground">
                  This research job is waiting to be processed.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : communityVoiceResult?.data || competitorResult?.data ? (
          /* Tabbed Results Interface */
          <>
            {/* Research Progress Stepper */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <ResearchProgress
                currentStep={
                  viabilityVerdict.availableDimensions === 2
                    ? 'viability-verdict'
                    : competitorResult?.data
                    ? 'competitor-analysis'
                    : 'community-voice'
                }
                completedSteps={[
                  ...(communityVoiceResult?.data ? ['community-voice' as const] : []),
                  ...(competitorResult?.data ? ['competitor-analysis' as const] : []),
                  ...(viabilityVerdict.availableDimensions === 2 ? ['viability-verdict' as const] : []),
                ]}
              />
            </div>

            <Tabs defaultValue="verdict" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="verdict" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Verdict
                {viabilityVerdict.availableDimensions > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {viabilityVerdict.overallScore.toFixed(1)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="community" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Community Voice
                {communityVoiceResult?.data && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="competitors" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Competitors
                {competitorResult?.data && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Verdict Tab */}
            <TabsContent value="verdict">
              <ViabilityVerdictDisplay
                verdict={viabilityVerdict}
                hypothesis={researchJob.hypothesis}
                jobId={id}
              />
            </TabsContent>

            {/* Community Voice Tab */}
            <TabsContent value="community">
              {communityVoiceResult?.data ? (
                <CommunityVoiceResults
                  results={communityVoiceResult.data}
                  jobId={id}
                  hypothesis={researchJob.hypothesis}
                  showNextStep={false}
                />
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Community Voice Not Run</h3>
                      <p className="text-muted-foreground mb-4">
                        Run Community Voice analysis to discover pain points and market signals.
                      </p>
                      <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                        <Button>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Run Community Voice
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Competitors Tab */}
            <TabsContent value="competitors">
              {competitorResult?.data ? (
                <CompetitorResults results={competitorResult.data} />
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Competitor Intelligence Not Run</h3>
                      <p className="text-muted-foreground mb-4">
                        Run Competitor Intelligence to analyze the competitive landscape.
                      </p>
                      <Link href={`/research/competitors?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                        <Button>
                          <Shield className="h-4 w-4 mr-2" />
                          Run Competitor Intelligence
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            </Tabs>
          </>
        ) : (
          /* No results at all */
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
                <p className="text-muted-foreground mb-4">
                  No research modules have been run for this hypothesis yet.
                </p>
                <div className="flex justify-center gap-4">
                  <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                    <Button variant="outline">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Run Community Voice
                    </Button>
                  </Link>
                  <Link href={`/research/competitors?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                    <Button>
                      <Shield className="h-4 w-4 mr-2" />
                      Run Competitor Intelligence
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  )
}
