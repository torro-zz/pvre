'use client'

import { motion } from 'framer-motion'
import { Database, Calendar, Clock, Users, Info, DollarSign, Filter } from 'lucide-react'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import { ScoreGauge } from '@/components/ui/score-gauge'
import { StatBlock } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/metric-row'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TrustBadge } from '@/components/ui/trust-badge'
import { AnimatedCard, AnimatedNumber } from '@/components/ui/animated-components'

interface ResearchHeroStatsProps {
  painScore: number
  painScoreConfidence: 'very_low' | 'low' | 'medium' | 'high'
  totalSignals: number
  coreSignals?: number
  wtpCount?: number
  relevanceRate: number
  dataConfidence: 'very_low' | 'low' | 'medium' | 'high'
  recencyScore?: number
  dataSources?: string[]
  communitiesCount: number
  communityNames?: string[]
  dateRange?: { oldest: string; newest: string }
  postsAnalyzed: number
  totalPostsFound: number
  commentsAnalyzed?: number
  processingTimeMs?: number
}

export function ResearchHeroStats({
  painScore,
  painScoreConfidence,
  totalSignals,
  coreSignals,
  wtpCount = 0,
  relevanceRate,
  dataConfidence,
  recencyScore,
  dataSources = [],
  communitiesCount,
  communityNames = [],
  dateRange,
  postsAnalyzed,
  totalPostsFound,
  commentsAnalyzed,
  processingTimeMs,
}: ResearchHeroStatsProps) {

  // Determine WTP strength for visual indicator
  const getWtpStrength = (count: number): 'none' | 'weak' | 'moderate' | 'strong' => {
    if (count === 0) return 'none'
    if (count <= 3) return 'weak'
    if (count <= 8) return 'moderate'
    return 'strong'
  }
  const wtpStrength = getWtpStrength(wtpCount)

  // Staggered animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
    },
  }

  return (
    <AnimatedCard className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Main content */}
      <div className="p-6">
        <div className="flex items-center gap-8">
          {/* Left: Score gauge with animation */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
          >
            <ScoreGauge score={painScore} label="Pain Score" />
          </motion.div>

          {/* Divider */}
          <motion.div
            className="w-px h-24 bg-border"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          />

          {/* Right: Key stats with stagger */}
          <motion.div
            className="flex-1 flex items-center justify-around"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* WTP - Most important signal, shown first */}
            <motion.div className="relative" variants={itemVariants}>
              <StatBlock
                label="WTP Signals"
                value={wtpCount}
                subValue={wtpStrength === 'none' ? 'No payment intent' : wtpStrength === 'weak' ? 'Weak' : wtpStrength === 'moderate' ? 'Moderate' : 'Strong'}
                accent={wtpCount > 0}
              />
              {wtpCount === 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center cursor-help"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: 'spring', stiffness: 400 }}
                    >
                      <span className="text-[10px] text-white font-bold">!</span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    No one mentioned paying for a solution. This is a critical validation gap.
                  </TooltipContent>
                </Tooltip>
              )}
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatBlock
                label="Signals"
                value={totalSignals}
                subValue={coreSignals !== undefined ? `${coreSignals} core` : undefined}
                subValueTooltip={coreSignals !== undefined ? "Core signals directly match your hypothesis. Supporting signals are related but indirect evidence." : undefined}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <StatBlock
                label="Posts Scanned"
                value={postsAnalyzed}
              />
            </motion.div>
            {commentsAnalyzed !== undefined && commentsAnalyzed > 0 && (
              <motion.div variants={itemVariants}>
                <StatBlock
                  label="Comments"
                  value={commentsAnalyzed}
                />
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Quality metrics row */}
        <motion.div
          className="mt-6 pt-5 border-t flex flex-wrap items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          {/* Confidence */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Confidence
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  Based on signal count. Very Low (&lt;10), Low (10-30), Medium (30-100), High (100+).
                </TooltipContent>
              </Tooltip>
            </div>
            <StatusBadge status={dataConfidence} />
          </div>

          {/* Recency */}
          {recencyScore !== undefined && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Recency
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[180px]">
                    How recent the data is. 100% = all from the last 30 days.
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {Math.round(recencyScore * 100)}%
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer with slide-up animation */}
      <motion.div
        className="px-6 py-3 bg-muted/30 border-t flex flex-wrap items-center gap-5 text-xs text-muted-foreground"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        {dataSources.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>{dataSources.join(' · ')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{communitiesCount} communities</span>
        </div>

        {/* Filtering transparency - shows how many posts were found vs matched */}
        {totalPostsFound > 0 && postsAnalyzed > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>
              {totalPostsFound.toLocaleString()} found → {postsAnalyzed.toLocaleString()} matched ({((postsAnalyzed / totalPostsFound) * 100).toFixed(1)}%)
            </span>
            <DataSourceBadge type="verified" showLabel={false} />
          </div>
        )}

        {dateRange && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRange.oldest} → {dateRange.newest}</span>
          </div>
        )}

        {processingTimeMs !== undefined && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>{(processingTimeMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </motion.div>
    </AnimatedCard>
  )
}
