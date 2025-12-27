'use client'

import { useMemo } from 'react'
import { FileText, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { AnimatedNumber } from '@/components/ui/animated-components'
import { cn } from '@/lib/utils'

interface ResearchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

interface QuickStatsProps {
  jobs: ResearchJob[]
}

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
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
}

export function QuickStats({ jobs }: QuickStatsProps) {
  const stats = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const total = jobs.length
    const thisWeek = jobs.filter(j => new Date(j.created_at) > weekAgo).length

    return { total, thisWeek }
  }, [jobs])

  // Don't render if no jobs
  if (jobs.length === 0) return null

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <StatCard
        icon={FileText}
        label="Total Research"
        value={stats.total}
        colorClass="text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400"
      />
      <StatCard
        icon={Calendar}
        label="This Week"
        value={stats.thisWeek}
        colorClass="text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400"
      />
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = '',
  colorClass
}: {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
  colorClass: string
}) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm',
        'hover:shadow-md transition-shadow duration-300'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold flex items-baseline gap-0.5">
            <AnimatedNumber value={value} decimals={0} duration={1.2} />
            {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {label}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
