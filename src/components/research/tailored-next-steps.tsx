'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  Zap,
  RefreshCw,
  Users,
  MessageSquare,
  Target,
  Compass,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HypothesisConfidenceLevel } from '@/lib/analysis/viability-calculator'

interface TailoredNextStepsProps {
  confidenceLevel: HypothesisConfidenceLevel
  hypothesisConfidenceScore: number
  adjacentThemes?: string[]
  hypothesis?: string
  className?: string
}

interface NextStepItem {
  number: number
  action: string
  detail: string
}

function getNextStepsContent(
  level: HypothesisConfidenceLevel,
  adjacentThemes: string[],
  hypothesis?: string
): {
  icon: React.ElementType
  iconColor: string
  badge: string
  badgeVariant: 'default' | 'secondary' | 'outline'
  title: string
  subtitle: string
  steps: NextStepItem[]
  resources?: string[]
} {
  switch (level) {
    case 'high':
      return {
        icon: CheckCircle2,
        iconColor: 'text-green-600',
        badge: 'PROCEED',
        badgeVariant: 'default',
        title: 'Proceed to Customer Interviews',
        subtitle: 'Strong evidence supports your hypothesis. Time to validate with real conversations.',
        steps: [
          {
            number: 1,
            action: 'Schedule 5-10 interviews',
            detail: 'Target your identified audience in communities where they gather',
          },
          {
            number: 2,
            action: 'Use the interview questions provided',
            detail: 'Focus on past behavior, not hypothetical future willingness',
          },
          {
            number: 3,
            action: 'Probe for current solutions',
            detail: 'What are they using today? What do they hate about it?',
          },
          {
            number: 4,
            action: 'Look for willingness-to-pay signals',
            detail: 'Have they spent money solving this? Would they pay for better?',
          },
        ],
      }

    case 'partial':
      return {
        icon: Zap,
        iconColor: 'text-amber-500',
        badge: 'EXPLORE',
        badgeVariant: 'secondary',
        title: 'Interview with Exploration',
        subtitle: 'Your hypothesis has some support, but adjacent problems may be stronger.',
        steps: [
          {
            number: 1,
            action: 'Interview about your hypothesis AND adjacent themes',
            detail: adjacentThemes.length > 0
              ? `Explore: ${adjacentThemes.slice(0, 2).join(', ')}`
              : 'Let conversations reveal which problems are most pressing',
          },
          {
            number: 2,
            action: 'Use open-ended discovery questions',
            detail: '"Walk me through a typical day..." and listen for pain points',
          },
          {
            number: 3,
            action: 'Be ready to pivot mid-interview',
            detail: 'If adjacent problems resonate more, explore them deeper',
          },
          {
            number: 4,
            action: 'Consider re-running research',
            detail: 'Try different keywords or a narrower audience definition',
          },
        ],
        resources: [
          'Try app analysis mode for higher-quality signals',
          'Search adjacent communities not covered',
          'Consider seasonal timing if relevant',
        ],
      }

    case 'low':
      return {
        icon: RefreshCw,
        iconColor: 'text-red-500',
        badge: 'PIVOT',
        badgeVariant: 'outline',
        title: 'Consider Pivoting',
        subtitle: 'Your specific hypothesis wasn\'t prominent, but we found valuable adjacent insights.',
        steps: [
          {
            number: 1,
            action: 'Review the adjacent opportunities above',
            detail: adjacentThemes.length > 0
              ? `Strong signals found for: ${adjacentThemes.slice(0, 3).join(', ')}`
              : 'Check the themes section for what IS being discussed',
          },
          {
            number: 2,
            action: 'Interview about what we FOUND, not your original hypothesis',
            detail: 'Your original idea may emerge naturally in conversation',
          },
          {
            number: 3,
            action: 'Reframe your hypothesis',
            detail: 'Pivot the problem definition based on actual market signals',
          },
          {
            number: 4,
            action: 'Run a new search with the pivot',
            detail: 'Test the reframed hypothesis with fresh research',
          },
        ],
        resources: [
          'Review the Customer Language Bank for pivot ideas',
          'Try a broader problem definition',
          'Consider a different audience segment',
        ],
      }
  }
}

export function TailoredNextSteps({
  confidenceLevel,
  hypothesisConfidenceScore,
  adjacentThemes = [],
  hypothesis,
  className,
}: TailoredNextStepsProps) {
  const content = getNextStepsContent(confidenceLevel, adjacentThemes, hypothesis)
  const Icon = content.icon

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            Your Next Steps
          </CardTitle>
          <Badge variant={content.badgeVariant}>
            {content.badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header with icon and title */}
        <div className="flex items-start gap-3 pb-3 border-b">
          <div className={cn('p-2 rounded-full bg-muted', content.iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">{content.title}</h3>
            <p className="text-sm text-muted-foreground">{content.subtitle}</p>
          </div>
        </div>

        {/* Numbered steps */}
        <div className="space-y-3">
          {content.steps.map((step) => (
            <div key={step.number} className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                {step.number}
              </div>
              <div>
                <p className="font-medium text-sm">{step.action}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Optional resources */}
        {content.resources && content.resources.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Also consider:</p>
            <div className="space-y-1">
              {content.resources.map((resource, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="w-3 h-3" />
                  <span>{resource}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interview tip */}
        <div className="bg-primary/5 rounded-lg p-3 mt-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Interview Tip</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {confidenceLevel === 'high'
              ? 'Focus questions on the specific problem you hypothesized. Probe for past behavior and spending.'
              : confidenceLevel === 'partial'
              ? 'Start with open discovery, then introduce your hypothesis. See if they bring up the problem naturally.'
              : 'Don\'t mention your original hypothesis. Ask broadly about challenges and see what emerges.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Generate tailored next steps data for PDF/server use
 */
export function generateNextStepsData(
  confidenceLevel: HypothesisConfidenceLevel,
  adjacentThemes: string[] = []
): {
  badge: string
  title: string
  subtitle: string
  steps: { action: string; detail: string }[]
  resources?: string[]
  interviewTip: string
} {
  const content = getNextStepsContent(confidenceLevel, adjacentThemes)

  return {
    badge: content.badge,
    title: content.title,
    subtitle: content.subtitle,
    steps: content.steps.map(s => ({ action: s.action, detail: s.detail })),
    resources: content.resources,
    interviewTip: confidenceLevel === 'high'
      ? 'Focus questions on the specific problem you hypothesized. Probe for past behavior and spending.'
      : confidenceLevel === 'partial'
      ? 'Start with open discovery, then introduce your hypothesis. See if they bring up the problem naturally.'
      : 'Don\'t mention your original hypothesis. Ask broadly about challenges and see what emerges.',
  }
}
