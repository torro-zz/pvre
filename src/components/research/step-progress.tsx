'use client'

import { StepStatusMap, StepStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import { Check, Lock, Loader2, AlertCircle } from 'lucide-react'

interface Step {
  key: keyof StepStatusMap
  label: string
  shortLabel: string
}

const STEPS: Step[] = [
  { key: 'pain_analysis', label: 'Pain Analysis', shortLabel: 'Pain' },
  { key: 'market_sizing', label: 'Market Sizing', shortLabel: 'Market' },
  { key: 'timing_analysis', label: 'Timing Analysis', shortLabel: 'Timing' },
  { key: 'competitor_analysis', label: 'Competitor Analysis', shortLabel: 'Competitors' },
]

interface StepProgressProps {
  stepStatus: StepStatusMap | null
  currentStep?: keyof StepStatusMap
  onStepClick?: (step: keyof StepStatusMap) => void
  className?: string
}

function getStepIcon(status: StepStatus) {
  switch (status) {
    case 'completed':
      return <Check className="h-4 w-4" />
    case 'in_progress':
      return <Loader2 className="h-4 w-4 animate-spin" />
    case 'failed':
      return <AlertCircle className="h-4 w-4" />
    case 'locked':
      return <Lock className="h-3.5 w-3.5" />
    case 'pending':
    default:
      return null
  }
}

function getStepStyles(status: StepStatus, isActive: boolean) {
  const base = 'relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all'

  if (status === 'completed') {
    return cn(base, 'bg-green-500 border-green-500 text-white')
  }
  if (status === 'in_progress') {
    return cn(base, 'bg-primary border-primary text-primary-foreground')
  }
  if (status === 'failed') {
    return cn(base, 'bg-destructive border-destructive text-destructive-foreground')
  }
  if (status === 'locked') {
    return cn(base, 'bg-muted border-muted-foreground/30 text-muted-foreground/50')
  }
  // pending
  if (isActive) {
    return cn(base, 'bg-background border-primary text-primary')
  }
  return cn(base, 'bg-background border-muted-foreground/30 text-muted-foreground')
}

function getConnectorStyles(status: StepStatus) {
  if (status === 'completed') {
    return 'bg-green-500'
  }
  if (status === 'in_progress') {
    return 'bg-primary'
  }
  return 'bg-muted-foreground/30'
}

export function StepProgress({
  stepStatus,
  currentStep,
  onStepClick,
  className,
}: StepProgressProps) {
  const defaultStatus: StepStatusMap = {
    pain_analysis: 'pending',
    market_sizing: 'locked',
    timing_analysis: 'locked',
    competitor_analysis: 'locked',
  }

  const status = stepStatus || defaultStatus

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop view */}
      <div className="hidden sm:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const stepState = status[step.key]
          const isActive = currentStep === step.key
          const isClickable = stepState !== 'locked' && onStepClick

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <button
                  type="button"
                  disabled={stepState === 'locked' || !onStepClick}
                  onClick={() => isClickable && onStepClick(step.key)}
                  className={cn(
                    getStepStyles(stepState, isActive),
                    isClickable && 'cursor-pointer hover:scale-105',
                    !isClickable && 'cursor-default'
                  )}
                >
                  {getStepIcon(stepState) || (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </button>
                <span
                  className={cn(
                    'mt-2 text-xs font-medium text-center',
                    stepState === 'completed' && 'text-green-600',
                    stepState === 'in_progress' && 'text-primary',
                    stepState === 'failed' && 'text-destructive',
                    stepState === 'locked' && 'text-muted-foreground/50',
                    stepState === 'pending' && 'text-muted-foreground',
                    isActive && stepState === 'pending' && 'text-primary'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-3">
                  <div
                    className={cn(
                      'h-0.5 w-full rounded-full transition-colors',
                      getConnectorStyles(stepState)
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile view - compact */}
      <div className="sm:hidden flex items-center justify-between">
        {STEPS.map((step, index) => {
          const stepState = status[step.key]
          const isActive = currentStep === step.key
          const isClickable = stepState !== 'locked' && onStepClick

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={stepState === 'locked' || !onStepClick}
                  onClick={() => isClickable && onStepClick(step.key)}
                  className={cn(
                    getStepStyles(stepState, isActive),
                    'w-7 h-7',
                    isClickable && 'cursor-pointer',
                    !isClickable && 'cursor-default'
                  )}
                >
                  {getStepIcon(stepState) || (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </button>
                <span
                  className={cn(
                    'mt-1 text-[10px] font-medium text-center',
                    stepState === 'completed' && 'text-green-600',
                    stepState === 'in_progress' && 'text-primary',
                    stepState === 'failed' && 'text-destructive',
                    stepState === 'locked' && 'text-muted-foreground/50',
                    stepState === 'pending' && 'text-muted-foreground',
                    isActive && stepState === 'pending' && 'text-primary'
                  )}
                >
                  {step.shortLabel}
                </span>
              </div>

              {/* Connector */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-1.5">
                  <div
                    className={cn(
                      'h-0.5 w-full rounded-full transition-colors',
                      getConnectorStyles(stepState)
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function getNextPendingStep(stepStatus: StepStatusMap | null): keyof StepStatusMap | null {
  const status = stepStatus || {
    pain_analysis: 'pending',
    market_sizing: 'locked',
    timing_analysis: 'locked',
    competitor_analysis: 'locked',
  }

  for (const step of STEPS) {
    if (status[step.key] === 'pending' || status[step.key] === 'in_progress') {
      return step.key
    }
  }

  return null
}

export function getStepLabel(step: keyof StepStatusMap): string {
  const found = STEPS.find((s) => s.key === step)
  return found?.label || step
}

export function isAllStepsCompleted(stepStatus: StepStatusMap | null): boolean {
  if (!stepStatus) return false
  return STEPS.every((step) => stepStatus[step.key] === 'completed')
}
