'use client'

import { Check, Circle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type StepStatus = 'completed' | 'current' | 'pending'
type StepId = 'community-voice' | 'competitor-analysis' | 'viability-verdict'

interface Step {
  id: StepId
  name: string
  status: StepStatus
  description?: string
}

interface ResearchProgressProps {
  currentStep: StepId
  completedSteps: StepId[]
  className?: string
  variant?: 'default' | 'compact'
}

const stepDefinitions: Array<{
  id: StepId
  name: string
  shortName: string
  description: string
}> = [
  {
    id: 'community-voice',
    name: 'Community Voice',
    shortName: '1. Community Voice',
    description: 'Analyze pain points from Reddit discussions',
  },
  {
    id: 'competitor-analysis',
    name: 'Competitor Analysis',
    shortName: '2. Competitors',
    description: 'Map the competitive landscape',
  },
  {
    id: 'viability-verdict',
    name: 'Viability Verdict',
    shortName: '3. Verdict',
    description: 'Get your final viability assessment',
  },
]

function getStepStatus(
  stepId: string,
  currentStep: string,
  completedSteps: string[]
): StepStatus {
  if (completedSteps.includes(stepId)) return 'completed'
  if (stepId === currentStep) return 'current'
  return 'pending'
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>
    )
  }
  if (status === 'current') {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-foreground bg-background">
        <Circle className="h-2 w-2 fill-foreground text-foreground" />
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground/40 bg-background">
      <Circle className="h-2 w-2 text-muted-foreground/40" />
    </div>
  )
}

export function ResearchProgress({
  currentStep,
  completedSteps,
  className,
  variant = 'default',
}: ResearchProgressProps) {
  const steps: Step[] = stepDefinitions.map((def) => ({
    ...def,
    status: getStepStatus(def.id, currentStep, completedSteps),
  }))

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  'text-xs font-medium',
                  step.status === 'completed' && 'text-foreground',
                  step.status === 'current' && 'text-foreground',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <nav aria-label="Research Progress" className={className}>
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn('flex items-center', index !== steps.length - 1 && 'flex-1')}
          >
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} />
              <span
                className={cn(
                  'mt-2 text-xs font-medium whitespace-nowrap',
                  step.status === 'completed' && 'text-foreground',
                  step.status === 'current' && 'text-foreground',
                  step.status === 'pending' && 'text-muted-foreground'
                )}
              >
                {stepDefinitions[index].shortName}
              </span>
            </div>

            {index !== steps.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-0.5 flex-1 transition-colors',
                  completedSteps.includes(stepDefinitions[index + 1].id)
                    ? 'bg-foreground'
                    : completedSteps.includes(step.id)
                    ? 'bg-foreground/30'
                    : 'bg-muted-foreground/20'
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

// Helper component for showing completion percentage
export function ResearchProgressBar({
  completedSteps,
  className,
}: {
  completedSteps: ('community-voice' | 'competitor-analysis' | 'viability-verdict')[]
  className?: string
}) {
  const completionPercentage = (completedSteps.length / 3) * 100

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Research Progress</span>
        <span>{completedSteps.length} of 3 complete</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-foreground transition-all duration-500"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
    </div>
  )
}
