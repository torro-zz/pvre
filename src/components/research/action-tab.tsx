'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  Lightbulb,
  Users,
  MessageSquare,
  AlertTriangle,
  Target,
  Sparkles,
  ChevronsUpDown,
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { ViabilityVerdict, HypothesisConfidence } from '@/lib/analysis/viability-calculator'
import { AnimatedCard, StaggerContainer, staggerItem } from '@/components/ui/animated-components'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

// ============================================
// Types
// ============================================

interface ActionTabProps {
  communityVoiceResult?: CommunityVoiceResult
  verdict: ViabilityVerdict
  hypothesis: string
}

// ============================================
// Helper Functions
// ============================================

function getActionRecommendation(confidence?: HypothesisConfidence): {
  status: 'proceed' | 'explore' | 'pivot'
  title: string
  description: string
  actions: string[]
  showEditButton?: boolean
} {
  if (!confidence) {
    return {
      status: 'explore',
      title: 'Tip: Broaden Your Search',
      description: 'Your hypothesis is specific, which limits matches. Try a broader problem statement.',
      actions: [
        'Simplify your hypothesis to focus on the core pain point',
        'Try: "Entrepreneurs struggling to find first customers" instead of a full problem statement',
        'Expand to additional communities or time range',
      ],
      showEditButton: true
    }
  }

  if (confidence.level === 'high') {
    return {
      status: 'proceed',
      title: 'Proceed with Confidence',
      description: 'Strong signals validate this problem. Time to talk to customers.',
      actions: [
        'Schedule 10 customer discovery interviews',
        'Use the interview guide below to structure conversations',
        'Focus on understanding current workarounds and willingness to pay',
        'Validate pricing assumptions with real conversations',
      ]
    }
  }

  if (confidence.level === 'partial') {
    return {
      status: 'explore',
      title: 'Next Steps',
      description: 'Some signals are present but the hypothesis needs refinement.',
      actions: [
        'Review the adjacent opportunities identified',
        'Consider narrowing your target audience',
        'Run 5-7 interviews to understand the nuances',
        'Test alternative problem framings',
      ]
    }
  }

  return {
    status: 'pivot',
    title: 'Consider Pivoting',
    description: 'Limited signals for your specific hypothesis. The market may exist for related problems.',
    actions: [
      'Review adjacent opportunities for stronger signals',
      'Talk to 3-5 people to understand why your angle isn\'t resonating',
      'Consider whether the problem exists but people describe it differently',
      'Look for underserved niches within the broader market',
    ]
  }
}

// ============================================
// Sub-Components
// ============================================

function RecommendationCard({
  recommendation,
  hypothesis
}: {
  recommendation: ReturnType<typeof getActionRecommendation>
  hypothesis?: string
}) {
  const statusColors = {
    proceed: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    explore: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    pivot: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  }

  const statusIcons = {
    proceed: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    explore: <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    pivot: <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  }

  return (
    <Card className={statusColors[recommendation.status]}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {statusIcons[recommendation.status]}
          <CardTitle className="text-lg">{recommendation.title}</CardTitle>
        </div>
        <CardDescription className="mt-1">{recommendation.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recommendation.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-background flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold">{i + 1}</span>
              </div>
              <span className="text-sm">{action}</span>
            </div>
          ))}
        </div>
        {recommendation.showEditButton && hypothesis && (
          <Button
            variant="outline"
            className="w-full mt-4"
            asChild
          >
            <a href={`/research?hypothesis=${encodeURIComponent(hypothesis)}`}>
              Edit Hypothesis & Re-run
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function InterviewGuideCard({
  interviewQuestions
}: {
  interviewQuestions?: CommunityVoiceResult['interviewQuestions']
}) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [allExpanded, setAllExpanded] = useState(false)
  // Key to force re-render of CollapsibleSections when toggling all
  const [expandKey, setExpandKey] = useState(0)

  if (!interviewQuestions) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Interview Guide Not Available</h3>
          <p className="text-muted-foreground">
            Run Community Voice analysis to generate tailored interview questions.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Helper to extract question text - AI sometimes returns objects
  const getQuestionText = (q: string | { question?: string; purpose?: string }): string => {
    return typeof q === 'string' ? q : (q.question || String(q))
  }

  const formatAllQuestions = () => {
    const { contextQuestions, problemQuestions, solutionQuestions } = interviewQuestions

    return `# Customer Discovery Interview Guide

## Context Questions
${contextQuestions.map((q, i) => `${i + 1}. ${getQuestionText(q)}`).join('\n')}

## Problem Exploration
${problemQuestions.map((q, i) => `${i + 1}. ${getQuestionText(q)}`).join('\n')}

## Solution Testing
${solutionQuestions.map((q, i) => `${i + 1}. ${getQuestionText(q)}`).join('\n')}

---
Based on "The Mom Test" principles - no leading questions, focus on past behavior.
`
  }

  const copyToClipboard = async (text: string, section: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSection(section)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const toggleAllSections = () => {
    setAllExpanded(!allExpanded)
    setExpandKey(prev => prev + 1)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Interview Guide
            </CardTitle>
            <CardDescription>
              Based on "The Mom Test" - focus on past behavior, not hypotheticals
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllSections}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronsUpDown className="h-4 w-4 mr-1" />
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(formatAllQuestions(), 'all')}
            >
              {copiedSection === 'all' ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Context Questions */}
        <CollapsibleSection
          key={`context-${expandKey}`}
          title="Context Questions"
          badge={interviewQuestions.contextQuestions.slice(0, 3).length}
          defaultOpen={allExpanded}
          className="border-0 bg-muted/30"
        >
          <ol className="space-y-2">
            {interviewQuestions.contextQuestions.slice(0, 3).map((q, i) => (
              <li key={i} className="text-sm pl-6 relative">
                <span className="absolute left-0 text-muted-foreground">{i + 1}.</span>
                {getQuestionText(q)}
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        {/* Problem Questions */}
        <CollapsibleSection
          key={`problem-${expandKey}`}
          title="Problem Exploration"
          badge={interviewQuestions.problemQuestions.slice(0, 3).length}
          defaultOpen={allExpanded}
          className="border-0 bg-muted/30"
        >
          <ol className="space-y-2">
            {interviewQuestions.problemQuestions.slice(0, 3).map((q, i) => (
              <li key={i} className="text-sm pl-6 relative">
                <span className="absolute left-0 text-muted-foreground">{i + 1}.</span>
                {getQuestionText(q)}
              </li>
            ))}
          </ol>
        </CollapsibleSection>

        {/* Solution Questions */}
        <CollapsibleSection
          key={`solution-${expandKey}`}
          title="Solution Testing"
          badge={interviewQuestions.solutionQuestions.slice(0, 3).length}
          defaultOpen={allExpanded}
          className="border-0 bg-muted/30"
        >
          <ol className="space-y-2">
            {interviewQuestions.solutionQuestions.slice(0, 3).map((q, i) => (
              <li key={i} className="text-sm pl-6 relative">
                <span className="absolute left-0 text-muted-foreground">{i + 1}.</span>
                {getQuestionText(q)}
              </li>
            ))}
          </ol>
        </CollapsibleSection>
      </CardContent>
    </Card>
  )
}

function AdjacentOpportunitiesCard({
  themes,
  hypothesis
}: {
  themes?: CommunityVoiceResult['themeAnalysis']['themes']
  hypothesis: string
}) {
  const contextualThemes = themes?.filter(t => (t as { tier?: string }).tier === 'contextual') || []

  if (contextualThemes.length === 0) return null

  // Find the max mentions for signal strength bars
  const maxMentions = Math.max(...contextualThemes.map(t => t.frequency), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Adjacent Opportunities
        </CardTitle>
        <CardDescription>
          Related problems that showed stronger signals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StaggerContainer className="space-y-3" staggerDelay={0.1} initialDelay={0.2}>
          {contextualThemes.slice(0, 3).map((theme, i) => (
            <motion.div
              key={i}
              className="p-3 rounded-lg bg-muted/50 border"
              variants={staggerItem}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{theme.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {theme.frequency} mentions
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{theme.description}</p>
              {/* Signal strength bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/70 rounded-full transition-all duration-500"
                  style={{ width: `${(theme.frequency / maxMentions) * 100}%` }}
                />
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </CardContent>
    </Card>
  )
}

function NextStepSummaryCard({
  themes,
}: {
  themes?: CommunityVoiceResult['themeAnalysis']['themes']
}) {
  // Find the top adjacent opportunity (contextual tier with highest mentions)
  const contextualThemes = themes?.filter(t => (t as { tier?: string }).tier === 'contextual') || []
  const topOpportunity = contextualThemes.length > 0
    ? contextualThemes.reduce((max, t) => t.frequency > max.frequency ? t : max, contextualThemes[0])
    : null

  return (
    <div className="flex gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border-l-3 border-emerald-500 rounded-lg">
      <div className="text-2xl flex-shrink-0">🎯</div>
      <div>
        <h4 className="font-semibold text-sm mb-1">Recommended Next Step</h4>
        <p className="text-sm text-muted-foreground">
          {topOpportunity ? (
            <>
              Run 5-7 customer interviews using the guide below. Focus on the &ldquo;<strong className="text-foreground">{topOpportunity.name}</strong>&rdquo; opportunity — it has the strongest signal ({topOpportunity.frequency} mentions).
            </>
          ) : (
            <>Run 5-7 customer interviews to validate these signals using the guide below.</>
          )}
        </p>
      </div>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function ActionTab({
  communityVoiceResult,
  verdict,
  hypothesis,
}: ActionTabProps) {
  const recommendation = getActionRecommendation(verdict.hypothesisConfidence)

  return (
    <div className="space-y-6">
      {/* Recommended Next Step Summary */}
      <AnimatedCard delay={0}>
        <NextStepSummaryCard themes={communityVoiceResult?.themeAnalysis?.themes} />
      </AnimatedCard>

      {/* Main Recommendation */}
      <AnimatedCard delay={0.1}>
        <RecommendationCard recommendation={recommendation} hypothesis={hypothesis} />
      </AnimatedCard>

      {/* Interview Guide */}
      <AnimatedCard delay={0.3}>
        <InterviewGuideCard interviewQuestions={communityVoiceResult?.interviewQuestions} />
      </AnimatedCard>

      {/* Adjacent Opportunities (if not high confidence) */}
      {verdict.hypothesisConfidence?.level !== 'high' && (
        <AnimatedCard delay={0.4}>
          <AdjacentOpportunitiesCard
            themes={communityVoiceResult?.themeAnalysis?.themes}
            hypothesis={hypothesis}
          />
        </AnimatedCard>
      )}

      {/* Research Gaps */}
      {verdict.redFlags && verdict.redFlags.length > 0 && (
        <AnimatedCard delay={0.5}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Research Gaps to Fill
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {verdict.redFlags.slice(0, 3).map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{i + 1}</span>
                    </div>
                    <span>{flag.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}
    </div>
  )
}
