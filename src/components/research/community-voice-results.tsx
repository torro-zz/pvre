'use client'

import { useState, useMemo } from 'react'
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
  Clock,
  Star,
  FileText,
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
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set([0])) // First card expanded by default
  const [expandedInterviewSections, setExpandedInterviewSections] = useState<Set<string>>(new Set(['context', 'problem', 'solution'])) // All expanded by default
  const { setActiveTab, communitySubTab, setCommunitySubTab } = useResearchTabs()

  const toggleInterviewSection = (section: string) => {
    setExpandedInterviewSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const toggleTheme = (index: number) => {
    setExpandedThemes(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Safely handle null/undefined painSignals array
  const painSignals = results.painSignals ?? []
  const displayedSignals = showAllSignals
    ? painSignals
    : painSignals.slice(0, 5)

  // Safe access to pain summary with defaults
  const totalSignals = results.painSummary?.totalSignals ?? 0

  // Theme frequency threshold - themes with <5 mentions are grouped into "Other mentions"
  const MIN_THEME_FREQUENCY = 5
  const { mainThemes, otherThemes } = useMemo(() => {
    const allThemes = results.themeAnalysis?.themes ?? []
    return {
      mainThemes: allThemes.filter(t => t.frequency >= MIN_THEME_FREQUENCY),
      otherThemes: allThemes.filter(t => t.frequency < MIN_THEME_FREQUENCY),
    }
  }, [results.themeAnalysis?.themes])
  const [showOtherThemes, setShowOtherThemes] = useState(false)

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

  // Helper to extract question text - AI sometimes returns {purpose, question} objects instead of strings
  const getQuestionText = (q: string | { question?: string; purpose?: string }): string => {
    return typeof q === 'string' ? q : (q.question || String(q))
  }

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const formatInterviewQuestions = (asMarkdown = false) => {
    const { contextQuestions, problemQuestions, solutionQuestions } =
      results.interviewQuestions

    const starMarker = asMarkdown ? '⭐ ' : ''

    return `# Interview Guide for: ${results.hypothesis}
${asMarkdown ? '\n> Estimated time: ~30 minutes\n' : ''}
## Context Questions
${contextQuestions.map((q, i) => `${i + 1}. ${i === 0 ? starMarker : ''}${getQuestionText(q)}${i === 0 && asMarkdown ? ' *(Start here)*' : ''}`).join('\n')}

## Problem Exploration
${problemQuestions.map((q, i) => `${i + 1}. ${i === 0 ? starMarker : ''}${getQuestionText(q)}${i === 0 && asMarkdown ? ' *(Start here)*' : ''}`).join('\n')}

## Solution Testing
${solutionQuestions.map((q, i) => `${i + 1}. ${i === 0 ? starMarker : ''}${getQuestionText(q)}${i === 0 && asMarkdown ? ' *(Start here)*' : ''}`).join('\n')}
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
                        <p className="text-sm text-muted-foreground mt-1">{rec.rationale}</p>
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
              s !== 'google_play' && s !== 'app_store' && s !== 'trustpilot' &&
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
            {/* Show Trustpilot if signals came from it */}
            {painSignals.some(s => s.source.subreddit.toLowerCase() === 'trustpilot') && (
              <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                ⭐ Trustpilot
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
        <div className="sticky top-0 z-10 bg-background py-2 -mx-1 px-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="signals">Pain Signals</TabsTrigger>
            <TabsTrigger value="quotes">Key Quotes</TabsTrigger>
            <TabsTrigger value="interview">Interview Guide</TabsTrigger>
          </TabsList>
        </div>

        {/* Themes Tab */}
        <TabsContent value="themes" className="space-y-4">
          {/* Header with count explanation and expand/collapse controls */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {mainThemes.length} significant themes from {totalSignals} signals
              {otherThemes.length > 0 && (
                <span className="text-muted-foreground/70"> (+{otherThemes.length} minor)</span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExpandedThemes(new Set(mainThemes.map((_, i) => i)))}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Expand All
              </button>
              <span className="text-muted-foreground/50">|</span>
              <button
                onClick={() => setExpandedThemes(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Collapse All
              </button>
            </div>
          </div>
          {/* Main Theme Cards (frequency >= 5) */}
          <div className="grid gap-4">
            {mainThemes.map((theme, index) => {
              const isExpanded = expandedThemes.has(index)
              return (
                <Card key={index} className="overflow-hidden">
                  <button
                    onClick={() => toggleTheme(index)}
                    className="w-full text-left"
                  >
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
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
                          {/* Combined Intensity/Resonance Badge - consolidated for cleaner UI */}
                          <Badge
                            variant="outline"
                            className={
                              theme.intensity === 'high'
                                ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
                                : theme.intensity === 'medium'
                                ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'border-muted-foreground/30 bg-muted/30 text-muted-foreground'
                            }
                          >
                            {theme.intensity === 'high' ? 'High' : theme.intensity === 'medium' ? 'Medium' : 'Low'} intensity
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {theme.frequency} mentions
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <p className="text-sm text-muted-foreground mb-3 pl-6">
                        {theme.description}
                      </p>
                      {/* Source Badges - show which data sources this theme came from */}
                      {theme.sources && theme.sources.length > 0 && (
                        <div className="flex gap-1.5 mb-3 pl-6">
                          {theme.sources.map((source: string) => (
                            <Badge
                              key={source}
                              variant="outline"
                              className={`text-xs font-normal ${
                                source === 'hacker_news' ? 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400' :
                                source === 'trustpilot' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : ''
                              }`}
                            >
                              {source === 'reddit' && 'Reddit'}
                              {source === 'hacker_news' && 'Hacker News'}
                              {source === 'trustpilot' && 'Trustpilot'}
                              {source === 'google_play' && 'Google Play'}
                              {source === 'app_store' && 'App Store'}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {theme.examples.length > 0 && (
                        <div className="space-y-2 pl-6">
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
                  )}
                </Card>
              )
            })}
          </div>

          {/* Other Mentions Section (frequency < 5) */}
          {otherThemes.length > 0 && (
            <Card className="border-dashed">
              <button
                onClick={() => setShowOtherThemes(!showOtherThemes)}
                className="w-full text-left"
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {showOtherThemes ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium text-muted-foreground">
                        Other mentions ({otherThemes.length})
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                      &lt;5 mentions each
                    </Badge>
                  </div>
                </CardContent>
              </button>
              {showOtherThemes && (
                <CardContent className="pt-0 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {otherThemes.map((theme, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs font-normal"
                        title={theme.description}
                      >
                        {theme.name} ({theme.frequency})
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    These topics appeared fewer than 5 times and may not represent statistically significant patterns.
                  </p>
                </CardContent>
              )}
            </Card>
          )}

          {/* Customer Language */}
          {results.themeAnalysis.customerLanguage.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Customer Language</CardTitle>
                    <CardDescription>
                      Exact phrases your target customers use
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(
                      results.themeAnalysis.customerLanguage.map(p => `"${p}"`).join('\n'),
                      'customerLanguage'
                    )}
                  >
                    {copiedSection === 'customerLanguage' ? (
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

          {/* Platforms Mentioned */}
          {results.themeAnalysis.alternativesMentioned.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Platforms Mentioned</CardTitle>
                <CardDescription>
                  Tools and platforms customers reference in discussions
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
            // P0 Fix 1: Pass strongest signal as quote object when available (find highest-intensity signal)
            strongestSignal={(() => {
              const highIntensitySignal = painSignals.find(s => s.intensity === 'high')
              if (highIntensitySignal) {
                return {
                  text: highIntensitySignal.text || highIntensitySignal.title || '',
                  subreddit: highIntensitySignal.source?.subreddit || '',
                  intensity: highIntensitySignal.intensity
                }
              }
              // Fallback to keyword if no high-intensity signal found
              return (results.painSummary as { strongestSignals?: string[] }).strongestSignals?.[0]
            })()}
            wtpQuote={(results.painSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes?.[0]}
            // P1 Fix 4: Pass totalSignals and coreSignals for clarity
            totalSignals={totalSignals}
            coreSignals={results.metadata.filteringMetrics?.coreSignals}
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

              {/* Emotions Breakdown - P1 Fix 3: Add explanation for >100% total */}
              {totalSignals > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Emotional Tone
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">Posts may express multiple emotions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'frustration', label: 'Frustrated', emoji: '😤', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
                      { key: 'anxiety', label: 'Anxious', emoji: '😰', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
                      { key: 'disappointment', label: 'Disappointed', emoji: '😞', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
                      { key: 'confusion', label: 'Confused', emoji: '😕', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
                      { key: 'hope', label: 'Hopeful', emoji: '🤞', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
                      { key: 'neutral', label: 'Neutral', emoji: '😐', color: 'bg-muted text-muted-foreground' },
                    ].map(({ key, label, emoji, color }) => {
                      const count = emotionsBreakdown[key as keyof typeof emotionsBreakdown] ?? 0
                      const percent = totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0
                      if (count === 0) return null
                      return (
                        <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${color}`}>
                          <span>{emoji}</span>
                          <span className="text-xs font-medium">{label}</span>
                          <span className="text-xs ml-auto">({count})</span>
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
                url: q.url,
                isDeleted: q.isDeleted,
                upvotes: q.upvotes,
                numComments: q.numComments,
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
                {results.themeAnalysis.willingnessToPaySignals.map((signal, i) => {
                  // Handle both legacy strings and new WtpSignal objects
                  const isLegacyString = typeof signal === 'string'
                  const quote = isLegacyString ? signal : signal.quote
                  const source = isLegacyString ? 'Reddit' : signal.source
                  const signalType = isLegacyString ? 'explicit' : signal.type
                  const url = isLegacyString ? undefined : signal.url
                  const sourceReliability = isLegacyString ? 'low' : signal.sourceReliability

                  return (
                    <WtpQuoteCard
                      key={i}
                      quote={quote}
                      source={source}
                      signalType={signalType}
                      url={url}
                      sourceReliability={sourceReliability}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Interview Guide Tab */}
        <TabsContent value="interview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Interview Questions</CardTitle>
                    <Badge variant="outline" className="text-xs font-normal">
                      <Clock className="h-3 w-3 mr-1" />
                      ~30 min
                    </Badge>
                  </div>
                  <CardDescription>
                    Based on "The Mom Test" principles - no leading questions, focus
                    on past behavior
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(formatInterviewQuestions(true), 'interview-md')
                    }
                    title="Copy as Markdown"
                  >
                    {copiedSection === 'interview-md' ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Markdown
                      </>
                    )}
                  </Button>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Context Questions - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleInterviewSection('context')}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <h4 className="font-semibold flex items-center gap-2">
                    <Badge>1</Badge>
                    Context Questions
                    <span className="text-xs text-muted-foreground font-normal">
                      ({results.interviewQuestions.contextQuestions.length} questions)
                    </span>
                  </h4>
                  {expandedInterviewSections.has('context') ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedInterviewSections.has('context') && (
                  <ol className="space-y-2 px-3 pb-3">
                    {results.interviewQuestions.contextQuestions.map((q, i) => (
                      <li key={i} className="text-sm pl-6 relative flex items-start gap-2">
                        <span className="absolute left-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{getQuestionText(q)}</span>
                        {i === 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                            Start here
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Problem Exploration - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleInterviewSection('problem')}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <h4 className="font-semibold flex items-center gap-2">
                    <Badge>2</Badge>
                    Problem Exploration
                    <span className="text-xs text-muted-foreground font-normal">
                      ({results.interviewQuestions.problemQuestions.length} questions)
                    </span>
                  </h4>
                  {expandedInterviewSections.has('problem') ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedInterviewSections.has('problem') && (
                  <ol className="space-y-2 px-3 pb-3">
                    {results.interviewQuestions.problemQuestions.map((q, i) => (
                      <li key={i} className="text-sm pl-6 relative flex items-start gap-2">
                        <span className="absolute left-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{getQuestionText(q)}</span>
                        {i === 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                            Start here
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Solution Testing - Collapsible */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleInterviewSection('solution')}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <h4 className="font-semibold flex items-center gap-2">
                    <Badge>3</Badge>
                    Solution Testing
                    <span className="text-xs text-muted-foreground font-normal">
                      ({results.interviewQuestions.solutionQuestions.length} questions)
                    </span>
                  </h4>
                  {expandedInterviewSections.has('solution') ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedInterviewSections.has('solution') && (
                  <ol className="space-y-2 px-3 pb-3">
                    {results.interviewQuestions.solutionQuestions.map((q, i) => (
                      <li key={i} className="text-sm pl-6 relative flex items-start gap-2">
                        <span className="absolute left-0 text-muted-foreground">
                          {i + 1}.
                        </span>
                        <span className="flex-1">{getQuestionText(q)}</span>
                        {i === 0 && (
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                            <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                            Start here
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Quick tip */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Tip: Start with questions marked with ⭐ if you have limited time
              </p>
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
                  onClick={() => setActiveTab('market')}
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
