'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  /** Score value */
  score: number
  /** Maximum score (default: 10) */
  max?: number
  /** Label below the gauge */
  label?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Custom color thresholds (as percentage of max) */
  thresholds?: {
    excellent: number // default 80%
    good: number      // default 60%
    fair: number      // default 40%
  }
}

const sizeConfig = {
  sm: { width: 80, fontSize: 'text-xl', labelSize: 'text-[9px]', subSize: 'text-[8px]' },
  md: { width: 120, fontSize: 'text-3xl', labelSize: 'text-xs', subSize: 'text-[10px]' },
  lg: { width: 160, fontSize: 'text-4xl', labelSize: 'text-sm', subSize: 'text-xs' },
}

export function ScoreGauge({
  score,
  max = 10,
  label,
  size = 'md',
  thresholds = { excellent: 80, good: 60, fair: 40 },
}: ScoreGaugeProps) {
  const percentage = (score / max) * 100
  const config = sizeConfig[size]
  const uniqueId = useId()

  const getColors = (pct: number) => {
    if (pct >= thresholds.excellent) return { primary: '#10b981', light: '#d1fae5', ring: '#a7f3d0' }
    if (pct >= thresholds.good) return { primary: '#f59e0b', light: '#fef3c7', ring: '#fde68a' }
    if (pct >= thresholds.fair) return { primary: '#f97316', light: '#ffedd5', ring: '#fed7aa' }
    return { primary: '#ef4444', light: '#fee2e2', ring: '#fecaca' }
  }

  const colors = getColors(percentage)
  const id = `gauge-${uniqueId}`

  return (
    <div className="relative flex flex-col items-center">
      {/* Soft colored background glow */}
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-xl"
        style={{ background: colors.light }}
      />

      {/* Main gauge container */}
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={`${id}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} />
              <stop offset="100%" stopColor={colors.ring} />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            strokeWidth="8"
            className="stroke-muted/30"
          />

          {/* Progress arc */}
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke={`url(#${id}-grad)`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${percentage * 2.64} 264`}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(config.fontSize, 'font-bold tracking-tight')}
            style={{ color: colors.primary }}
          >
            {score.toFixed(1)}
          </span>
          <span className={cn(config.subSize, 'font-medium text-muted-foreground')}>
            of {max}
          </span>
        </div>
      </div>

      {/* Label */}
      {label && (
        <span className={cn(config.labelSize, 'mt-2 font-semibold text-muted-foreground uppercase tracking-wide')}>
          {label}
        </span>
      )}
    </div>
  )
}
