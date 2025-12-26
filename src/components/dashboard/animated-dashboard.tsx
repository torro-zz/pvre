'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ============================================
// Stagger animation config
// ============================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
}

// ============================================
// Dashboard Header Animation
// ============================================
interface DashboardHeaderProps {
  title: ReactNode
  subtitle: string
}

export function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm sm:text-base">
        {subtitle}
      </p>
    </motion.div>
  )
}

// ============================================
// Animated Card Grid
// ============================================
interface AnimatedGridProps {
  children: ReactNode
  className?: string
}

export function AnimatedGrid({ children, className }: AnimatedGridProps) {
  return (
    <motion.div
      className={cn('grid gap-4 sm:gap-6', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

// ============================================
// Animated Card Item
// ============================================
interface AnimatedItemProps {
  children: ReactNode
  className?: string
}

export function AnimatedItem({ children, className }: AnimatedItemProps) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}

// ============================================
// Progress Banner Animation
// ============================================
interface ProgressBannerProps {
  children: ReactNode
  className?: string
}

export function ProgressBanner({ children, className }: ProgressBannerProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// Feature Grid Item (for the 4 feature indicators)
// ============================================
const featureVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
}

interface FeatureGridProps {
  children: ReactNode
  className?: string
}

export function FeatureGrid({ children, className }: FeatureGridProps) {
  return (
    <motion.div
      className={cn('grid grid-cols-2 gap-2 sm:gap-3', className)}
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05,
            delayChildren: 0.2,
          },
        },
      }}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function FeatureItem({ children, className }: AnimatedItemProps) {
  return (
    <motion.div className={className} variants={featureVariants}>
      {children}
    </motion.div>
  )
}
