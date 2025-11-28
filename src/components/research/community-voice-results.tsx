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
  TrendingUp,
  MessageSquare,
  Users,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Quote,
  DollarSign,
  Copy,
  Check,
} from 'lucide-react'
import { PainScoreCard, PainScoreCardCompact } from './pain-score-card'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'

interface CommunityVoiceResultsProps {
  results: CommunityVoiceResult
}

export function CommunityVoiceResults({ results }: CommunityVoiceResultsProps) {
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  const displayedSignals = showAllSignals
    ? results.painSignals
    : results.painSignals.slice(0, 5)

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
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pain Score</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.themeAnalysis.overallPainScore}/10
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Signals Found</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.painSummary.totalSignals}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Posts Analyzed</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.metadata.postsAnalyzed}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing Time</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(results.metadata.processingTimeMs / 1000).toFixed(1)}s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{results.themeAnalysis.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Subreddits analyzed:</span>
            {results.subreddits.analyzed.map((sub) => (
              <Badge key={sub} variant="outline">
                r/{sub}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="themes" className="space-y-4">
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
                    <h4 className="font-semibold">{theme.name}</h4>
                    <div className="flex items-center gap-2">
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
                  <span>{results.painSummary.highIntensityCount}</span>
                </div>
                <Progress
                  value={
                    (results.painSummary.highIntensityCount /
                      results.painSummary.totalSignals) *
                    100
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
                  <span>{results.painSummary.mediumIntensityCount}</span>
                </div>
                <Progress
                  value={
                    (results.painSummary.mediumIntensityCount /
                      results.painSummary.totalSignals) *
                    100
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
                  <span>{results.painSummary.lowIntensityCount}</span>
                </div>
                <Progress
                  value={
                    (results.painSummary.lowIntensityCount /
                      results.painSummary.totalSignals) *
                    100
                  }
                  className="h-2"
                />
              </div>

              <div className="pt-4 border-t flex gap-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">
                    {results.painSummary.solutionSeekingCount} seeking solutions
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {results.painSummary.willingnessToPayCount} WTP signals
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pain Signal Cards */}
          <div className="space-y-3">
            {displayedSignals.map((signal) => (
              <PainScoreCard key={signal.source.id} signal={signal} />
            ))}
          </div>

          {results.painSignals.length > 5 && (
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
                  Show All {results.painSignals.length} Signals
                </>
              )}
            </Button>
          )}
        </TabsContent>

        {/* Key Quotes Tab */}
        <TabsContent value="quotes" className="space-y-4">
          <div className="space-y-4">
            {results.themeAnalysis.keyQuotes.map((quote, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Quote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <p className="text-lg italic">"{quote.quote}"</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span>{quote.source}</span>
                        <Badge variant="outline">Score: {quote.painScore}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Willingness to Pay Signals */}
          {results.themeAnalysis.willingnessToPaySignals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Willingness to Pay Signals
                </CardTitle>
                <CardDescription>
                  Evidence that customers would pay for a solution
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.themeAnalysis.willingnessToPaySignals.map((signal, i) => (
                  <p key={i} className="text-sm border-l-2 border-green-500 pl-3">
                    "{signal}"
                  </p>
                ))}
              </CardContent>
            </Card>
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
    </div>
  )
}
