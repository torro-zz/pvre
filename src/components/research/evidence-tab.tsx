'use client'

/**
 * EvidenceTab - Sub-tabbed evidence display for research results.
 *
 * Sub-tabs:
 * - Overview: Executive summary + data quality quick view
 * - Themes: Theme cards with customer language
 * - Signals: Pain score display + signal cards
 * - Quotes: Key quotes + WTP signals
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  BarChart3,
  Target,
  ChevronDown,
  ChevronUp,
  Quote,
  DollarSign,
  Copy,
  Check,
  MessageSquare,
  Layers,
  FileText,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { PainScoreCard } from './pain-score-card'
import { PainScoreDisplay } from './pain-score-display'
import { QuoteList, WtpQuoteCard } from '@/components/ui/quote-card'
import { DataQualityInsights } from './data-quality-insights'
import type { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import type { FilteringMetrics } from '@/lib/research/fetch-research-data'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'

type EvidenceSubTab = 'overview' | 'themes' | 'signals' | 'quotes'

interface EvidenceTabProps {
  communityVoiceResult: CommunityVoiceResult
  filteringMetrics?: FilteringMetrics
}

export function EvidenceTab({ communityVoiceResult, filteringMetrics }: EvidenceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<EvidenceSubTab>('overview')
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set([0]))

  const results = communityVoiceResult
  const painSignals = results.painSignals ?? []
  const displayedSignals = showAllSignals ? painSignals : painSignals.slice(0, 5)
  const totalSignals = results.painSummary?.totalSignals ?? 0

  // Calculate pain score
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

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  // Sub-tab navigation items
  const subTabs: { id: EvidenceSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'themes', label: 'Themes', icon: <Layers className="h-4 w-4" /> },
    { id: 'signals', label: 'Signals', icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'quotes', label: 'Quotes', icon: <Quote className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.id === 'signals' && totalSignals > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {totalSignals}
              </Badge>
            )}
            {tab.id === 'themes' && results.themeAnalysis.themes.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {results.themeAnalysis.themes.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Overview Sub-tab */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Summary Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pain Score Card */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setActiveSubTab('signals')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Pain Score</span>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">
                  {calculatedPainScore.score.toFixed(1)}/10
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalSignals} signals found
                </p>
              </CardContent>
            </Card>

            {/* Themes Card */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setActiveSubTab('themes')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Themes</span>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">
                  {results.themeAnalysis.themes.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {results.themeAnalysis.themes.filter(t => t.intensity === 'high').length} high intensity
                </p>
              </CardContent>
            </Card>

            {/* WTP Signals Card */}
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setActiveSubTab('quotes')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">WTP Signals</span>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">
                  {results.painSummary?.willingnessToPayCount ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Willingness to pay indicators
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Executive Summary
              </CardTitle>
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

              {/* Sources analyzed */}
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="text-sm text-muted-foreground">Sources analyzed:</span>
                {results.subreddits.analyzed.filter(s =>
                  s !== 'google_play' && s !== 'app_store' && s !== 'trustpilot' &&
                  s.toLowerCase() !== 'hackernews' && s.toLowerCase() !== 'askhn' && s.toLowerCase() !== 'showhn'
                ).map((sub) => (
                  <Badge key={sub} variant="outline">
                    r/{sub}
                  </Badge>
                ))}
                {painSignals.some(s => ['hackernews', 'askhn', 'showhn'].includes(s.source.subreddit.toLowerCase())) && (
                  <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400">
                    Hacker News
                  </Badge>
                )}
                {painSignals.some(s => s.source.subreddit.toLowerCase() === 'trustpilot') && (
                  <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    Trustpilot
                  </Badge>
                )}
                {painSignals.some(s => s.source.subreddit === 'google_play') && (
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/30">
                    Google Play
                  </Badge>
                )}
                {painSignals.some(s => s.source.subreddit === 'app_store') && (
                  <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30">
                    App Store
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data Quality Insights (compact) */}
          {filteringMetrics && (
            <DataQualityInsights
              diagnostics={{
                postsFound: filteringMetrics.postsFound,
                postsPassedFilter: filteringMetrics.postsAnalyzed,
                relevanceRate: filteringMetrics.postsFound > 0 ? Math.round((filteringMetrics.postsAnalyzed / filteringMetrics.postsFound) * 100) : 0,
                coreSignals: filteringMetrics.coreSignals ?? 0,
                totalSignals: totalSignals,
                confidence: results.painSummary?.dataConfidence ?? 'low',
                expansionAttempts: filteringMetrics.expansionAttempts ?? undefined,
                communitiesSearched: filteringMetrics.communitiesSearched || results.subreddits?.analyzed,
                timeRangeMonths: filteringMetrics.timeRangeMonths,
              }}
            />
          )}
        </div>
      )}

      {/* Themes Sub-tab */}
      {activeSubTab === 'themes' && (
        <div className="space-y-4">
          {/* Header with expand/collapse controls */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {results.themeAnalysis.themes.length} themes identified from {totalSignals} signals
              {results.themeAnalysis.themes.length > 1 && totalSignals > 0 && (
                <span className="text-muted-foreground/70"> (some signals relate to multiple themes)</span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExpandedThemes(new Set(results.themeAnalysis.themes.map((_, i) => i)))}
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

          {/* Theme Cards */}
          <div className="grid gap-4">
            {results.themeAnalysis.themes.map((theme, index) => {
              const isExpanded = expandedThemes.has(index)
              return (
                <Card key={index} className="overflow-hidden">
                  <button onClick={() => toggleTheme(index)} className="w-full text-left">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <h4 className="font-semibold">{theme.name}</h4>
                          {theme.tier === 'contextual' && (
                            <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                              contextual
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
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
                          <span className="text-sm text-muted-foreground">{theme.frequency} mentions</span>
                        </div>
                      </div>
                    </CardContent>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <p className="text-sm text-muted-foreground mb-3 pl-6">{theme.description}</p>
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
                            <p key={i} className="text-sm italic border-l-2 pl-3 text-muted-foreground">
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

          {/* Customer Language */}
          {results.themeAnalysis.customerLanguage.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Customer Language</CardTitle>
                    <CardDescription>Exact phrases your target customers use</CardDescription>
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
                <CardDescription>Tools and platforms customers reference in discussions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {results.themeAnalysis.alternativesMentioned.map((alt, i) => (
                    <Badge key={i} variant="outline">{alt}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Signals Sub-tab */}
      {activeSubTab === 'signals' && (
        <div className="space-y-4">
          {/* Pain Score Display */}
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
            strongestSignal={(() => {
              const highIntensitySignal = painSignals.find(s => s.intensity === 'high')
              if (highIntensitySignal) {
                return {
                  text: highIntensitySignal.text || highIntensitySignal.title || '',
                  subreddit: highIntensitySignal.source?.subreddit || '',
                  intensity: highIntensitySignal.intensity
                }
              }
              return (results.painSummary as { strongestSignals?: string[] }).strongestSignals?.[0]
            })()}
            wtpQuote={(results.painSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes?.[0]}
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
                  value={totalSignals > 0 ? ((results.painSummary?.highIntensityCount ?? 0) / totalSignals) * 100 : 0}
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
                  value={totalSignals > 0 ? ((results.painSummary?.mediumIntensityCount ?? 0) / totalSignals) * 100 : 0}
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
                  value={totalSignals > 0 ? ((results.painSummary?.lowIntensityCount ?? 0) / totalSignals) * 100 : 0}
                  className="h-2"
                />
              </div>

              <div className="pt-4 border-t flex gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{results.painSummary?.solutionSeekingCount ?? 0} seeking solutions</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{results.painSummary?.willingnessToPayCount ?? 0} WTP signals</span>
                </div>
              </div>

              {/* Emotions Breakdown */}
              {totalSignals > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Emotional Tone
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">Posts may express multiple emotions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: 'frustration', label: 'Frustrated', emoji: '', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
                      { key: 'anxiety', label: 'Anxious', emoji: '', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' },
                      { key: 'disappointment', label: 'Disappointed', emoji: '', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
                      { key: 'confusion', label: 'Confused', emoji: '', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400' },
                      { key: 'hope', label: 'Hopeful', emoji: '', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' },
                      { key: 'neutral', label: 'Neutral', emoji: '', color: 'bg-muted text-muted-foreground' },
                    ].map(({ key, label, color }) => {
                      const count = emotionsBreakdown[key as keyof typeof emotionsBreakdown] ?? 0
                      if (count === 0) return null
                      return (
                        <div key={key} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${color}`}>
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
            <Button variant="outline" className="w-full" onClick={() => setShowAllSignals(!showAllSignals)}>
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
        </div>
      )}

      {/* Quotes Sub-tab */}
      {activeSubTab === 'quotes' && (
        <div className="space-y-6">
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
                // Engagement metrics for transparency
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
                  const isLegacyString = typeof signal === 'string'
                  const quote = isLegacyString ? signal : signal.quote
                  const source = isLegacyString ? 'Reddit' : signal.source
                  const signalType = isLegacyString ? 'explicit' : signal.type
                  const url = isLegacyString ? undefined : signal.url

                  return (
                    <WtpQuoteCard
                      key={i}
                      quote={quote}
                      source={source}
                      signalType={signalType}
                      url={url}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
