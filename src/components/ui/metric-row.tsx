'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricRowProps {
  /** Label text */
  label: string
  /** Current value */
  value: number
  /** Maximum value (default: 100) */
  max?: number
  /** Optional icon */
  icon?: LucideIcon
  /** Show percentage or raw value */
  showPercentage?: boolean
  /** Custom color thresholds (as percentage) */
  thresholds?: {
    good: number    // default 50%
    fair: number    // default 25%
  }
  /** Size variant */
  size?: 'sm' | 'md'
}

const sizeConfig = {
  sm: {
    labelSize: 'text-[9px]',
    valueSize: 'text-xs',
    barHeight: 'h-1',
    iconSize: 'w-3 h-3',
    gap: 'gap-2',
  },
  md: {
    labelSize: 'text-[10px]',
    valueSize: 'text-sm',
    barHeight: 'h-2',
    iconSize: 'w-4 h-4',
    gap: 'gap-3',
  },
}

export function MetricRow({
  label,
  value,
  max = 100,
  icon: Icon,
  showPercentage = true,
  thresholds = { good: 50, fair: 25 },
  size = 'md',
}: MetricRowProps) {
  const config = sizeConfig[size]
  const percentage = Math.min((value / max) * 100, 100)

  const getColor = (pct: number) => {
    if (pct >= thresholds.good) return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-500',
    }
    if (pct >= thresholds.fair) return {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-500',
    }
    return {
      bar: 'bg-orange-500',
      text: 'text-orange-600 dark:text-orange-500',
    }
  }

  const colors = getColor(percentage)

  return (
    <div className={cn('flex items-center', config.gap)}>
      {/* Label section */}
      <div className={cn('flex items-center gap-1.5 min-w-[100px]', config.gap)}>
        {Icon && <Icon className={cn(config.iconSize, 'text-muted-foreground')} />}
        <span className={cn(
          config.labelSize,
          'font-medium text-muted-foreground uppercase tracking-wide'
        )}>
          {label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-3">
        <div className={cn('flex-1 bg-muted/50 rounded-full overflow-hidden', config.barHeight)}>
          <div
            className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn(config.valueSize, 'font-semibold tabular-nums', colors.text)}>
          {showPercentage ? `${Math.round(percentage)}%` : value.toLocaleString()}
        </span>
      </div>
    </div>
  )
}

// Badge variant for confidence/status
interface StatusBadgeProps {
  status: 'high' | 'medium' | 'low' | 'very_low' | 'success' | 'warning' | 'error' | 'pending'
  size?: 'sm' | 'md'
}

const statusStyles: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  very_low: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  pending: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-400',
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'

  return (
    <span className={cn(
      'rounded-full font-semibold uppercase',
      sizeClass,
      statusStyles[status] || statusStyles.pending
    )}>
      {status.replace('_', ' ')}
    </span>
  )
}
