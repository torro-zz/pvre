'use client'

import { motion } from 'framer-motion'
import { Trophy, TrendingUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { AnimatedNumber, AnimatedCard, StaggerContainer, staggerItem } from '@/components/ui/animated-components'

interface TopPerformer {
  id: string
  hypothesis: string
  score: number
  verdict: 'strong' | 'mixed' | 'weak' | 'none'
}

interface TopPerformersProps {
  performers: TopPerformer[]
  className?: string
}

export function TopPerformers({ performers, className }: TopPerformersProps) {
  if (performers.length === 0) {
    return null
  }

  const getVerdictConfig = (verdict: TopPerformer['verdict']) => {
    switch (verdict) {
      case 'strong':
        return { bg: 'bg-emerald-500', label: 'Strong' }
      case 'mixed':
        return { bg: 'bg-amber-500', label: 'Mixed' }
      case 'weak':
        return { bg: 'bg-orange-500', label: 'Emerging' }
      default:
        return { bg: 'bg-red-500', label: 'Pause' }
    }
  }

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 0:
        return 'text-amber-500' // Gold
      case 1:
        return 'text-slate-400' // Silver
      case 2:
        return 'text-amber-700' // Bronze
      default:
        return 'text-muted-foreground'
    }
  }

  const truncateHypothesis = (text: string, maxLength: number = 45) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength).trim() + '...'
  }

  return (
    <AnimatedCard className={cn('rounded-xl border bg-card p-5', className)} delay={0.3}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-base">Top Performers</h3>
      </div>

      {/* Leaderboard */}
      <StaggerContainer className="space-y-3" staggerDelay={0.1} initialDelay={0.4}>
        {performers.slice(0, 3).map((performer, index) => {
          const verdictConfig = getVerdictConfig(performer.verdict)
          const percentage = (performer.score / 10) * 100

          return (
            <motion.div
              key={performer.id}
              variants={staggerItem}
              className="group"
            >
              <Link
                href={`/research/${performer.id}`}
                className="block p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className={cn('flex-shrink-0 font-bold text-lg', getMedalColor(index))}>
                    {index + 1}.
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {truncateHypothesis(performer.hypothesis)}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', verdictConfig.bg)}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.5 + index * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                      <AnimatedNumber
                        value={performer.score}
                        decimals={1}
                        delay={0.6 + index * 0.1}
                        duration={0.8}
                        className="text-sm font-semibold w-8 text-right"
                      />
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </StaggerContainer>

      {/* Footer */}
      {performers.length > 3 && (
        <motion.div
          className="mt-4 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            View all research
          </Link>
        </motion.div>
      )}
    </AnimatedCard>
  )
}
