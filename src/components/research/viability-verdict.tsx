'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Lightbulb,
  Shield,
  BarChart3,
  Info,
  ArrowRight,
  Target,
  PieChart,
} from 'lucide-react'
import Link from 'next/link'
import { useResearchTabs } from './research-tabs-context'
import {
  ViabilityVerdict,
  VerdictColors,
  StatusColors,
  StatusLabels,
  VerdictLevel,
  SampleSizeLabel,
} from '@/lib/analysis/viability-calculator'

interface ViabilityVerdictProps {
  verdict: ViabilityVerdict
  hypothesis: string
  jobId?: string
  onRunCommunityVoice?: () => void
  onRunCompetitors?: () => void
}

export function ViabilityVerdictDisplay({
  verdict,
  hypothesis,
  jobId,
  onRunCommunityVoice,
  onRunCompetitors,
}: ViabilityVerdictProps) {
  const colors = VerdictColors[verdict.verdict]
  const { setActiveTab, setCommunitySubTab } = useResearchTabs()

  const getVerdictIcon = (level: VerdictLevel) => {
    switch (level) {
      case 'strong':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />
      case 'mixed':
        return <AlertTriangle className="h-8 w-8 text-yellow-500" />
      case 'weak':
        return <AlertTriangle className="h-8 w-8 text-orange-500" />
      case 'none':
        return <XCircle className="h-8 w-8 text-red-500" />
    }
  }

  const getConfidenceLabel = (confidence: 'low' | 'medium' | 'high') => {
    switch (confidence) {
      case 'high':
        return 'High confidence - based on substantial data'
      case 'medium':
        return 'Medium confidence - more data would improve accuracy'
      case 'low':
        return 'Low confidence - limited data available'
    }
  }

  const getSampleSizeColor = (label: SampleSizeLabel) => {
    switch (label) {
      case 'high_confidence':
        return 'bg-green-500'
      case 'moderate_confidence':
        return 'bg-blue-500'
      case 'low_confidence':
        return 'bg-yellow-500'
      case 'very_limited':
        return 'bg-orange-500'
    }
  }

  // Get severity color for red flags
  const getRedFlagSeverityColor = (severity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 border-red-300 text-red-800'
      case 'MEDIUM':
        return 'bg-orange-100 border-orange-300 text-orange-800'
      case 'LOW':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* P1 FIX: Red Flags Section - Shown BEFORE the score */}
      {verdict.redFlags && verdict.redFlags.length > 0 && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Red Flags Detected
            </CardTitle>
            <CardDescription className="text-red-600">
              Critical warning signs that may affect viability
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {verdict.redFlags.map((flag, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-md border ${getRedFlagSeverityColor(flag.severity)}`}
                >
                  <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{flag.title}</div>
                    <div className="text-sm opacity-90">{flag.message}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`ml-auto flex-shrink-0 ${
                      flag.severity === 'HIGH'
                        ? 'border-red-500 text-red-700'
                        : flag.severity === 'MEDIUM'
                        ? 'border-orange-500 text-orange-700'
                        : 'border-yellow-500 text-yellow-700'
                    }`}
                  >
                    {flag.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Verdict Card */}
      <Card className={`border-2 ${colors.border}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {getVerdictIcon(verdict.verdict)}
              <div>
                <CardTitle className="text-2xl">Viability Verdict</CardTitle>
                <CardDescription className="mt-1">
                  {verdict.isComplete
                    ? 'Complete assessment based on all available dimensions'
                    : `Partial assessment (${verdict.availableDimensions}/${verdict.totalDimensions} dimensions)`}
                </CardDescription>
              </div>
            </div>

            {/* Score Display */}
            <div className="text-right">
              <div className={`text-4xl font-bold ${colors.text}`}>
                {verdict.scoreRange ? (
                  <>
                    {verdict.overallScore.toFixed(1)}
                    <span className="text-lg text-muted-foreground"> ±{(verdict.scoreRange.max - verdict.overallScore).toFixed(1)}</span>
                  </>
                ) : (
                  <>
                    {verdict.overallScore.toFixed(1)}
                    <span className="text-lg text-muted-foreground">/10</span>
                  </>
                )}
              </div>
              <Badge className={`${colors.bg} text-white mt-1`}>
                {verdict.calibratedVerdictLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Score Progress Bar */}
          <div className="space-y-2">
            <div className="relative">
              <Progress value={verdict.overallScore * 10} className="h-4" />
              {/* Threshold markers */}
              <div className="absolute top-0 left-0 w-full h-4 flex items-center pointer-events-none">
                <div
                  className="absolute border-l-2 border-gray-400 h-6 -top-1"
                  style={{ left: '25%' }}
                  title="Weak threshold (2.5)"
                />
                <div
                  className="absolute border-l-2 border-gray-400 h-6 -top-1"
                  style={{ left: '50%' }}
                  title="Mixed threshold (5.0)"
                />
                <div
                  className="absolute border-l-2 border-gray-400 h-6 -top-1"
                  style={{ left: '75%' }}
                  title="Strong threshold (7.5)"
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No Signal</span>
              <span>Weak</span>
              <span>Mixed</span>
              <span>Strong</span>
            </div>
          </div>

          {/* Verdict Description */}
          <div className={`${colors.bgLight} rounded-lg p-4`}>
            <p className={`font-medium ${colors.text}`}>{verdict.verdictDescription}</p>
          </div>

          {/* Limited Data Warning */}
          {verdict.sampleSize && (verdict.sampleSize.label === 'very_limited' || verdict.sampleSize.label === 'low_confidence') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Limited data available</p>
                <p className="text-sm text-amber-700 mt-1">
                  This verdict is based on {verdict.sampleSize.postsAnalyzed} relevant posts.
                  {verdict.sampleSize.postsAnalyzed < 20
                    ? ' Consider this a directional signal rather than definitive evidence. Try broader search terms or additional communities to gather more data.'
                    : ' More data would increase confidence. Consider expanding your search to additional communities.'}
                </p>
              </div>
            </div>
          )}

          {/* Confidence & Data Sufficiency Indicators */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-3 h-3 rounded-full ${
                  verdict.confidence === 'high'
                    ? 'bg-green-500'
                    : verdict.confidence === 'medium'
                    ? 'bg-yellow-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-muted-foreground">
                {getConfidenceLabel(verdict.confidence)}
              </span>
            </div>
            {/* Data Sufficiency Indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-3 h-3 rounded-full ${
                  verdict.dataSufficiency === 'strong'
                    ? 'bg-green-500'
                    : verdict.dataSufficiency === 'adequate'
                    ? 'bg-blue-500'
                    : verdict.dataSufficiency === 'limited'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-muted-foreground">
                Data: {verdict.dataSufficiencyReason}
              </span>
            </div>
            {/* Sample Size Indicator */}
            {verdict.sampleSize && (
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${getSampleSizeColor(verdict.sampleSize.label)}`} />
                <span className="text-muted-foreground">
                  Sample: {verdict.sampleSize.postsAnalyzed} posts analyzed ({verdict.sampleSize.signalsFound} signals) — {verdict.sampleSize.description}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dimension Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dimension Breakdown
          </CardTitle>
          <CardDescription>
            How each research dimension contributes to your overall score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verdict.dimensions.length > 0 ? (
            verdict.dimensions.map((dim) => (
              <div key={dim.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {dim.name === 'Pain Score' ? (
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    ) : dim.name === 'Market Score' ? (
                      <PieChart className="h-4 w-4 text-muted-foreground" />
                    ) : dim.name === 'Timing Score' ? (
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{dim.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(dim.weight * 100)}% weight
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${StatusColors[dim.status]}`}>
                      {dim.score.toFixed(1)}/10
                    </span>
                    <Badge
                      variant="outline"
                      className={`${
                        dim.status === 'strong'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : dim.status === 'adequate'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : dim.status === 'needs_work'
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {StatusLabels[dim.status]}
                    </Badge>
                  </div>
                </div>
                <Progress value={dim.score * 10} className="h-2" />
                {dim.summary && (
                  <p className="text-xs text-muted-foreground">{dim.summary}</p>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No research dimensions available yet.</p>
              <p className="text-sm">Run research modules to generate your Viability Verdict.</p>
            </div>
          )}

          {/* Missing dimensions CTAs */}
          {!verdict.isComplete && verdict.dimensions.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Complete more research to improve your verdict accuracy:
              </p>
              <div className="flex flex-wrap gap-2">
                {!verdict.dimensions.find((d) => d.name === 'Pain Score') && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={jobId ? `/research?jobId=${jobId}` : '/research'}>
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Run Community Voice
                    </Link>
                  </Button>
                )}
                {!verdict.dimensions.find((d) => d.name === 'Competition Score') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('competitors')}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Run Competitor Intelligence
                  </Button>
                )}
                {!verdict.dimensions.find((d) => d.name === 'Market Score') && (
                  <Badge variant="outline" className="text-xs py-1 px-2">
                    <PieChart className="h-3 w-3 mr-1" />
                    Market Score auto-runs with Community Voice
                  </Badge>
                )}
                {!verdict.dimensions.find((d) => d.name === 'Timing Score') && (
                  <Badge variant="outline" className="text-xs py-1 px-2">
                    <BarChart3 className="h-3 w-3 mr-1" />
                    Timing Score auto-runs with Community Voice
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dealbreakers */}
      {verdict.dealbreakers.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Dealbreakers Detected
            </CardTitle>
            <CardDescription className="text-red-600">
              Critical issues that may make this opportunity non-viable
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {verdict.dealbreakers.map((dealbreaker, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">{dealbreaker}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {verdict.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations
            </CardTitle>
            <CardDescription>
              Suggested next steps to improve viability or validate further
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {verdict.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex-shrink-0">
                    {i + 1}
                  </div>
                  <span className="text-sm text-muted-foreground">{rec}</span>
                </li>
              ))}
            </ul>

            {/* Next Steps CTA - Interview Guide */}
            {verdict.isComplete && verdict.verdict !== 'none' && (
              <div className="mt-6 pt-4 border-t bg-green-50 -mx-6 px-6 pb-4 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-800">Ready to validate with real customers?</p>
                    <p className="text-sm text-green-600">
                      Get your personalized Interview Guide with Mom Test questions
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      // Switch to Community tab and Interview subtab using context
                      setCommunitySubTab('interview')
                      setActiveTab('community')
                    }}
                  >
                    View Interview Guide
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-700">
              <p className="font-medium">About the Viability Verdict</p>
              <p>
                This score combines multiple research dimensions using dynamically weighted averages.
                Full formula: Pain (35%) + Market (25%) + Competition (25%) + Timing (15%).
              </p>
              <p>
                Market Sizing analyzes TAM/SAM/SOM using Fermi estimation. Timing Analysis
                identifies tailwinds, headwinds, and your market timing window.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
