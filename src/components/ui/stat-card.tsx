'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  /** Label text */
  label: string
  /** Main value */
  value: string | number
  /** Secondary value/description */
  subValue?: string
  /** Optional icon */
  icon?: LucideIcon
  /** Accent/highlight the card */
  accent?: boolean
  /** Trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
  }
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Optional click handler */
  onClick?: () => void
}

const sizeConfig = {
  sm: {
    padding: 'p-3',
    labelSize: 'text-[9px]',
    valueSize: 'text-lg',
    subSize: 'text-[10px]',
    iconSize: 'w-3.5 h-3.5',
  },
  md: {
    padding: 'p-4',
    labelSize: 'text-[10px]',
    valueSize: 'text-2xl',
    subSize: 'text-xs',
    iconSize: 'w-4 h-4',
  },
  lg: {
    padding: 'p-6',
    labelSize: 'text-xs',
    valueSize: 'text-3xl',
    subSize: 'text-sm',
    iconSize: 'w-5 h-5',
  },
}

export function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  accent,
  trend,
  size = 'md',
  onClick,
}: StatCardProps) {
  const config = sizeConfig[size]

  return (
    <div
      className={cn(
        'rounded-xl border bg-card transition-all duration-200',
        config.padding,
        accent && 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30'
      )}
      onClick={onClick}
    >
      {/* Label row */}
      <div className="flex items-center gap-2 mb-1">
        {Icon && (
          <Icon className={cn(config.iconSize, 'text-muted-foreground')} />
        )}
        <span className={cn(
          config.labelSize,
          'font-medium text-muted-foreground uppercase tracking-wide'
        )}>
          {label}
        </span>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-2">
        <span className={cn(
          config.valueSize,
          'font-bold tabular-nums',
          accent ? 'text-emerald-600 dark:text-emerald-500' : 'text-foreground'
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {subValue && (
          <span className={cn(config.subSize, 'text-muted-foreground')}>
            {subValue}
          </span>
        )}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div className={cn(
          'mt-1 flex items-center gap-1',
          config.subSize,
          trend.direction === 'up' && 'text-emerald-600',
          trend.direction === 'down' && 'text-red-500',
          trend.direction === 'neutral' && 'text-muted-foreground'
        )}>
          {trend.direction === 'up' && '↑'}
          {trend.direction === 'down' && '↓'}
          {trend.direction === 'neutral' && '→'}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}

// Variant for inline stat display (no card)
interface StatBlockProps {
  label: string
  value: string | number
  subValue?: string
  accent?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function StatBlock({
  label,
  value,
  subValue,
  accent,
  size = 'md',
}: StatBlockProps) {
  const config = sizeConfig[size]

  return (
    <div className="text-center px-4">
      <div className={cn(
        config.labelSize,
        'font-medium text-muted-foreground uppercase tracking-wide mb-1'
      )}>
        {label}
      </div>
      <div className="flex items-baseline justify-center gap-1.5">
        <span className={cn(
          config.valueSize,
          'font-bold tabular-nums',
          accent ? 'text-emerald-600 dark:text-emerald-500' : 'text-foreground'
        )}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {subValue && (
          <span className={cn(config.subSize, 'text-muted-foreground')}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  )
}
