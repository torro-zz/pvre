'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { RefreshCw, CheckCircle2, Pause, XCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { VerdictLevel } from '@/lib/analysis/viability-calculator'

interface RecommendationBannerProps {
  verdict: VerdictLevel
  verdictDescription?: string
  onViewDetails?: () => void
  className?: string
}

const recommendationConfig: Record<VerdictLevel, {
  icon: typeof RefreshCw
  title: string
  description: string
  ctaText: string
  bgClass: string
  borderClass: string
  iconClass: string
  textClass: string
}> = {
  strong: {
    icon: CheckCircle2,
    title: 'Proceed to Customer Interviews',
    description: 'Strong signals validate this problem exists. Time to talk to real users and validate further.',
    ctaText: 'Get Interview Questions',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    textClass: 'text-emerald-900 dark:text-emerald-100',
  },
  mixed: {
    icon: RefreshCw,
    title: 'Consider Pivoting Your Hypothesis',
    description: 'Your specific angle wasn\'t prominent, but we found adjacent opportunities worth exploring.',
    ctaText: 'See Adjacent Opportunities',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
  weak: {
    icon: Pause,
    title: 'More Research Needed',
    description: 'Limited signals found. Consider expanding your search or refining your hypothesis.',
    ctaText: 'View Suggestions',
    bgClass: 'bg-zinc-50 dark:bg-zinc-900/50',
    borderClass: 'border-zinc-200 dark:border-zinc-700',
    iconClass: 'text-zinc-600 dark:text-zinc-400',
    textClass: 'text-zinc-900 dark:text-zinc-100',
  },
  none: {
    icon: XCircle,
    title: 'Reconsider This Direction',
    description: 'The data suggests significant challenges with this hypothesis. Review the analysis carefully.',
    ctaText: 'View Analysis',
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-900 dark:text-red-100',
  },
}

export function RecommendationBanner({
  verdict,
  verdictDescription,
  onViewDetails,
  className,
}: RecommendationBannerProps) {
  const config = recommendationConfig[verdict]
  const Icon = config.icon

  // Subtle icon animation based on verdict type
  const iconAnimation = verdict === 'strong'
    ? { scale: [1, 1.1, 1], transition: { duration: 0.5, delay: 0.3 } }
    : verdict === 'mixed'
    ? { rotate: [0, 180, 360], transition: { duration: 0.8, delay: 0.3 } }
    : {}

  return (
    <div className={cn(
      'rounded-lg border p-4',
      config.bgClass,
      config.borderClass,
      className
    )}>
      <div className="flex items-start gap-3">
        <motion.div
          className={cn('mt-0.5', config.iconClass)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, ...iconAnimation }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <motion.h3
            className={cn('font-semibold text-sm', config.textClass)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {config.title}
          </motion.h3>
          <motion.p
            className={cn('text-sm mt-0.5 opacity-80', config.textClass)}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            {verdictDescription || config.description}
          </motion.p>
          {onViewDetails && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewDetails}
                className={cn('mt-2 -ml-2 h-7 text-xs group', config.iconClass, 'hover:bg-transparent hover:underline')}
              >
                {config.ctaText}
                <motion.span
                  className="inline-block ml-1"
                  initial={{ x: 0 }}
                  whileHover={{ x: 3 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-3 w-3" />
                </motion.span>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
