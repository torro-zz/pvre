'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Target,
  ChevronDown,
  ChevronUp,
  Quote,
  DollarSign,
  Copy,
  Check,
  ArrowRight,
  Building2,
  HelpCircle,
  Zap,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { useResearchTabs } from './research-tabs-context'
import { PainScoreCard, PainScoreCardCompact } from './pain-score-card'
import { PainScoreDisplay } from './pain-score-display'
import { QuoteCard, QuoteList, WtpQuoteCard, QuoteData } from '@/components/ui/quote-card'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'

interface CommunityVoiceResultsProps {
  results: CommunityVoiceResult
  jobId?: string
  hypothesis?: string
  showNextStep?: boolean
}

export function CommunityVoiceResults({ results, jobId, hypothesis, showNextStep = true }: CommunityVoiceResultsProps) {
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const { setActiveTab, communitySubTab, setCommunitySubTab } = useResearchTabs()

  // Safely handle null/undefined painSignals array
  const painSignals = results.painSignals ?? []
  const displayedSignals = showAllSignals
    ? painSignals
    : painSignals.slice(0, 5)

  // Safe access to pain summary with defaults
  const totalSignals = results.painSummary?.totalSignals ?? 0

  // Calculate consistent pain score using the same formula as Viability Verdict
  // This ensures the same score appears in Community Voice header and Verdict dimensions
  const defaultEmotions = { frustration: 0, anxiety: 0, disappointment: 0, confusion: 0, hope: 0, neutral: 0 }
  const emotionsBreakdown = results.painSummary?.emotionsBreakdown ?? defaultEmotions

  const calculatedPainScore = results.painSummary
    ? calculateOverallPainScore({
        totalSignals: results.painSummary.totalSignals ?? 0,
        averageScore: results.painSummary.averageScore ?? 0,
        highIntensityCount: results.painSummary.highIntensityCount ?? 0,
        mediumIntensityCount: results.painSummary.mediumIntensityCount ?? 0,
        lowIntensityCount: results.painSummary.lowIntensityCount ?? 0,
        solutionSeekingCount: results.painSummary.solutionSeekingCount ?? 0,
        willingnessToPayCount: results.painSummary.willingnessToPayCount ?? 0,
        topSubreddits: results.painSummary.topSubreddits ?? [],
        dataConfidence: results.painSummary.dataConfidence ?? 'low',
        strongestSignals: results.painSummary.strongestSignals ?? [],
        wtpQuotes: results.painSummary.wtpQuotes ?? [],
        temporalDistribution: results.painSummary.temporalDistribution ?? {
          last30Days: 0,
          last90Days: 0,
          last180Days: 0,
          older: results.painSummary.totalSignals ?? 0,
        },
        dateRange: results.painSummary.dateRange,
        recencyScore: results.painSummary.recencyScore ?? 0.5,
        emotionsBreakdown: emotionsBreakdown,
      })
    : { score: 0, confidence: 'very_low' as const, reasoning: '' }

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const formatInterviewQuestions = () => {
    const { contextQuestions, problemQuestions, solutionQuestions } =
      results.interviewQuestions

    return `# Interview Guide for: ${results.hypothesis}

## Context Questions
${contextQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Problem Exploration
${problemQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Solution Testing
${solutionQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
`
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{results.themeAnalysis.summary}</p>

          {/* Key Opportunity */}
          {results.themeAnalysis.keyOpportunity && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Key Opportunity</span>
              </div>
              <p className="text-sm text-green-800 dark:text-green-300">{results.themeAnalysis.keyOpportunity}</p>
            </div>
          )}

          {/* Strategic Recommendations */}
          {results.themeAnalysis.strategicRecommendations && results.themeAnalysis.strategicRecommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Strategic Recommendations</h4>
              <div className="space-y-2">
                {results.themeAnalysis.strategicRecommendations.map((rec, index) => (
                  <div key={index} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-sm">{rec.action}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Sources analyzed:</span>
            {/* Show Reddit subreddits */}
            {results.subreddits.analyzed.filter(s =>
              s !== 'google_play' && s !== 'app_store' &&
              s.toLowerCase() !== 'hackernews' && s.toLowerCase() !== 'askhn' && s.toLowerCase() !== 'showhn'
            ).map((sub) => (
              <Badge key={sub} variant="outline">
                r/{sub}
              </Badge>
            ))}
            {/* Show Hacker News if signals came from it */}
            {painSignals.some(s => ['hackernews', 'askhn', 'showhn'].includes(s.source.subreddit.toLowerCase())) && (
              <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400">
                🔶 Hacker News
              </Badge>
            )}
            {/* Show App Store sources if signals came from them */}
            {painSignals.some(s => s.source.subreddit === 'google_play') && (
              <Badge variant="outline" className="bg-green-500/10 border-green-500/30">
                🤖 Google Play
              </Badge>
            )}
            {painSignals.some(s => s.source.subreddit === 'app_store') && (
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30">
                🍎 App Store
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs value={communitySubTab} onValueChange={(v) => setCommunitySubTab(v as 'themes' | 'signals' | 'quotes' | 'interview')} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="signals">Pain Signals</TabsTrigger>
          <TabsTrigger value="quotes">Key Quotes</TabsTrigger>
          <TabsTrigger value="interview">Interview Guide</TabsTrigger>
        </TabsList>

        {/* Themes Tab */}
        <TabsContent value="themes" className="space-y-4">
          <div className="grid gap-4">
            {results.themeAnalysis.themes.map((theme, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{theme.name}</h4>
                      {/* Tier Badge - shows if theme is from core or contextual signals */}
                      {theme.tier === 'contextual' && (
                        <Badge
                          variant="outline"
                          className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs"
                        >
                          contextual
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Resonance Badge */}
                      {theme.resonance && (
                        <Badge
                          variant="outline"
                          className={
                            theme.resonance === 'high'
                              ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : theme.resonance === 'medium'
                              ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                              : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
                          }
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          {theme.resonance === 'high' ? 'High' : theme.resonance === 'medium' ? 'Med' : 'Low'} resonance
                        </Badge>
                      )}
                      {/* Intensity Badge */}
                      <Badge
                        variant={
                          theme.intensity === 'high'
                            ? 'destructive'
                            : theme.intensity === 'medium'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {theme.intensity}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {theme.frequency} mentions
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {theme.description}
                  </p>
                  {/* Source Badges - show which data sources this theme came from */}
                  {theme.sources && theme.sources.length > 0 && (
                    <div className="flex gap-1.5 mb-3">
                      {theme.sources.map((source: string) => (
                        <Badge
                          key={source}
                          variant="outline"
                          className={`text-xs font-normal ${source === 'hacker_news' ? 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400' : ''}`}
                        >
                          {source === 'reddit' && '💬 Reddit'}
                          {source === 'hacker_news' && '🔶 Hacker News'}
                          {source === 'google_play' && '🤖 Google Play'}
                          {source === 'app_store' && '🍎 App Store'}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {theme.examples.length > 0 && (
                    <div className="space-y-2">
                      {theme.examples.map((example, i) => (
                        <p
                          key={i}
                          className="text-sm italic border-l-2 pl-3 text-muted-foreground"
                        >
                          "{example}"
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Customer Language */}
          {results.themeAnalysis.customerLanguage.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Language</CardTitle>
                <CardDescription>
                  Exact phrases your target customers use
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.themeAnalysis.customerLanguage.map((phrase, i) => (
                    <Badge key={i} variant="secondary">
                      "{phrase}"
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alternatives Mentioned */}
          {results.themeAnalysis.alternativesMentioned.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alternatives Mentioned</CardTitle>
                <CardDescription>
                  Existing solutions customers are aware of
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.themeAnalysis.alternativesMentioned.map((alt, i) => (
                    <Badge key={i} variant="outline">
                      {alt}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Pain Signals Tab */}
        <TabsContent value="signals" className="space-y-4">
          {/* Pain Score Display - Inspired by clean minimal design */}
          <PainScoreDisplay
            score={results.themeAnalysis.overallPainScore}
            confidence={(results.painSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'medium'}
            summary={{
              ...results.painSummary,
              dataConfidence: (results.painSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'medium',
              strongestSignals: (results.painSummary as { strongestSignals?: string[] }).strongestSignals || [],
              wtpQuotes: (results.painSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes || [],
              temporalDistribution: (results.painSummary as { temporalDistribution?: { last30Days: number; last90Days: number; last180Days: number; older: number } }).temporalDistribution || { last30Days: 0, last90Days: 0, last180Days: 0, older: 0 },
              recencyScore: (results.painSummary as { recencyScore?: number }).recencyScore || 1.0,
            }}
            postsAnalyzed={results.metadata.postsAnalyzed}
            strongestSignal={(results.painSummary as { strongestSignals?: string[] }).strongestSignals?.[0]}
            wtpQuote={(results.painSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes?.[0]}
          />

          {/* Intensity Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pain Intensity Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    High Intensity
                  </span>
                  <span>{results.painSummary?.highIntensityCount ?? 0}</span>
                </div>
                <Progress
                  value={
                    totalSignals > 0
                      ? ((results.painSummary?.highIntensityCount ?? 0) / totalSignals) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    Medium Intensity
                  </span>
                  <span>{results.painSummary?.mediumIntensityCount ?? 0}</span>
                </div>
                <Progress
                  value={
                    totalSignals > 0
                      ? ((results.painSummary?.mediumIntensityCount ?? 0) / totalSignals) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    Low Intensity
                  </span>
                  <span>{results.painSummary?.lowIntensityCount ?? 0}</span>
                </div>
                <Progress
                  value={
                    totalSignals > 0
                      ? ((results.painSummary?.lowIntensityCount ?? 0) / totalSignals) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              <div className="pt-4 border-t flex gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">
                    {results.painSummary?.solutionSeekingCount ?? 0} seeking solutions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {results.painSummary?.willingnessToPayCount ?? 0} WTP signals
                  </span>
                </div>
              </div>

              {/* Emotions Breakdown */}
              {totalSignals > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Emotional Tone
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'frustration', label: 'Frustration', emoji: '😤', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
                      { key: 'anxiety', label: 'Anxiety', emoji: '😰', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
                      { key: 'disappointment', label: 'Disappointment', emoji: '😞', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
                      { key: 'confusion', label: 'Confusion', emoji: '😕', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
                      { key: 'hope', label: 'Hope', emoji: '🤞', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
                      { key: 'neutral', label: 'Neutral', emoji: '😐', color: 'bg-muted text-muted-foreground' },
                    ].map(({ key, label, emoji, color }) => {
                      const count = emotionsBreakdown[key as keyof typeof emotionsBreakdown] ?? 0
                      const percent = totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0
                      if (count === 0) return null
                      return (
                        <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${color}`}>
                          <span>{emoji}</span>
                          <span className="text-xs font-medium">{label}</span>
                          <span className="text-xs ml-auto">{percent}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pain Signal Cards */}
          {painSignals.length > 0 ? (
            <div className="space-y-3">
              {displayedSignals.map((signal) => (
                <PainScoreCard key={signal.source.id} signal={signal} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No pain signals found for this hypothesis.</p>
              <p className="text-sm mt-2 text-muted-foreground">Try broadening your search terms or targeting different communities.</p>
            </Card>
          )}

          {painSignals.length > 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAllSignals(!showAllSignals)}
            >
              {showAllSignals ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Show All {painSignals.length} Signals
                </>
              )}
            </Button>
          )}
        </TabsContent>

        {/* Key Quotes Tab */}
        <TabsContent value="quotes" className="space-y-6">
          {/* Key Pain Quotes */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Key Pain Quotes
            </h4>
            <QuoteList
              quotes={results.themeAnalysis.keyQuotes.map(q => ({
                quote: q.quote,
                source: q.source,
                painScore: q.painScore,
                relevanceScore: q.relevanceScore,
              }))}
              trustLevel="verified"
              variant="default"
              showRelevance={true}
            />
          </div>

          {/* Willingness to Pay Signals */}
          {results.themeAnalysis.willingnessToPaySignals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-green-500" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Willingness to Pay Signals
                </h4>
                <span className="text-xs text-muted-foreground">
                  ({results.themeAnalysis.willingnessToPaySignals.length} signals)
                </span>
              </div>
              <div className="space-y-3">
                {results.themeAnalysis.willingnessToPaySignals.map((signal, i) => (
                  <WtpQuoteCard
                    key={i}
                    quote={signal}
                    source="Community"
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Interview Guide Tab */}
        <TabsContent value="interview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Interview Questions</CardTitle>
                  <CardDescription>
                    Based on "The Mom Test" principles - no leading questions, focus
                    on past behavior
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(formatInterviewQuestions(), 'interview')
                  }
                >
                  {copiedSection === 'interview' ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>1</Badge>
                  Context Questions
                </h4>
                <ol className="space-y-2">
                  {results.interviewQuestions.contextQuestions.map((q, i) => (
                    <li key={i} className="text-sm pl-6 relative">
                      <span className="absolute left-0 text-muted-foreground">
                        {i + 1}.
                      </span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>2</Badge>
                  Problem Exploration
                </h4>
                <ol className="space-y-2">
                  {results.interviewQuestions.problemQuestions.map((q, i) => (
                    <li key={i} className="text-sm pl-6 relative">
                      <span className="absolute left-0 text-muted-foreground">
                        {i + 1}.
                      </span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Badge>3</Badge>
                  Solution Testing
                </h4>
                <ol className="space-y-2">
                  {results.interviewQuestions.solutionQuestions.map((q, i) => (
                    <li key={i} className="text-sm pl-6 relative">
                      <span className="absolute left-0 text-muted-foreground">
                        {i + 1}.
                      </span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Next Step CTA - Enhanced Competitor Analysis Banner */}
      {showNextStep && hypothesis && (
        <div className="relative overflow-hidden rounded-xl border-2 border-foreground/10 bg-gradient-to-r from-muted/50 via-background to-muted/50">
          {/* Progress indicator */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <div className="h-full w-1/2 bg-foreground rounded-r transition-all duration-500" />
          </div>

          <div className="p-6 pt-8">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs font-medium">
                Step 1 of 2 Complete
              </Badge>
              {results.themeAnalysis.alternativesMentioned.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {results.themeAnalysis.alternativesMentioned.length} competitors found
                </Badge>
              )}
            </div>

            {/* Main content */}
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-semibold tracking-tight">
                  Continue to Competitor Analysis
                </h3>
                <p className="text-muted-foreground">
                  Analyze your competitive landscape to find positioning opportunities and market gaps.
                </p>

                {/* What you'll discover */}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                    Market overview
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                    Competitor matrix
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                    Gap analysis
                  </span>
                </div>

                {/* Competitors teaser */}
                {results.themeAnalysis.alternativesMentioned.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      Competitors mentioned in discussions:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {results.themeAnalysis.alternativesMentioned.slice(0, 4).map((alt, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {alt}
                        </Badge>
                      ))}
                      {results.themeAnalysis.alternativesMentioned.length > 4 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{results.themeAnalysis.alternativesMentioned.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <div className="flex-shrink-0">
                <Button
                  size="lg"
                  className="w-full md:w-auto gap-2 text-base px-6"
                  onClick={() => setActiveTab('competitors')}
                >
                  <Building2 className="h-5 w-5" />
                  Run Competitor Analysis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
