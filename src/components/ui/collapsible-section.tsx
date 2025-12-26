'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface CollapsibleSectionProps {
  title: string
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: React.ReactNode
}

export function CollapsibleSection({
  title,
  badge,
  badgeVariant = 'secondary',
  defaultOpen = true,
  children,
  className,
  headerClassName,
  contentClassName,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  const badgeColorMap = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-muted text-muted-foreground',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    destructive: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          headerClassName
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
          <span className="font-medium text-sm truncate">{title}</span>
          {badge !== undefined && (
            <Badge
              variant="outline"
              className={cn('text-xs font-normal ml-1', badgeColorMap[badgeVariant])}
            >
              {badge}
            </Badge>
          )}
        </div>
        <motion.div
          initial={false}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={cn('px-4 pb-4 pt-1', contentClassName)}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Compact variant for inline text expansion (e.g., long hypothesis)
interface CollapsibleTextProps {
  text: string
  maxLength?: number
  className?: string
}

export function CollapsibleText({
  text,
  maxLength = 100,
  className,
}: CollapsibleTextProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const needsCollapse = text.length > maxLength

  if (!needsCollapse) {
    return <span className={className}>{text}</span>
  }

  const displayText = isExpanded ? text : text.slice(0, maxLength).trim() + '...'

  return (
    <span className={className}>
      {displayText}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-1 text-primary hover:underline focus:outline-none focus-visible:underline text-sm font-medium"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  )
}
