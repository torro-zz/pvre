'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useSpring, useTransform, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

// ============================================
// AnimatedNumber - Smooth counting animation
// ============================================
interface AnimatedNumberProps {
  value: number
  duration?: number
  decimals?: number
  className?: string
  delay?: number
}

export function AnimatedNumber({
  value,
  duration = 1.2,
  decimals = 1,
  className,
  delay = 0
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  })

  const display = useTransform(spring, (current) =>
    current.toFixed(decimals)
  )

  const [displayValue, setDisplayValue] = useState('0.0')

  useEffect(() => {
    if (isInView) {
      const timeout = setTimeout(() => {
        spring.set(value)
      }, delay * 1000)
      return () => clearTimeout(timeout)
    }
  }, [isInView, value, spring, delay])

  useEffect(() => {
    const unsubscribe = display.on('change', (v) => {
      setDisplayValue(v)
    })
    return unsubscribe
  }, [display])

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.3, delay }}
    >
      {displayValue}
    </motion.span>
  )
}

// ============================================
// AnimatedProgress - Circular progress ring
// ============================================
interface AnimatedProgressProps {
  percentage: number
  size: number
  strokeWidth: number
  colorClass: string
  delay?: number
  duration?: number
}

export function AnimatedProgress({
  percentage,
  size,
  strokeWidth,
  colorClass,
  delay = 0,
  duration = 1.2,
}: AnimatedProgressProps) {
  const ref = useRef<SVGCircleElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <svg
      className="w-full h-full -rotate-90"
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted/20"
      />
      {/* Animated progress circle */}
      <motion.circle
        ref={ref}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={colorClass}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={isInView ? { strokeDashoffset } : {}}
        transition={{
          duration,
          delay,
          ease: [0.4, 0, 0.2, 1], // Custom easing for smooth feel
        }}
      />
    </svg>
  )
}

// ============================================
// AnimatedCard - Fade + slide animation
// ============================================
interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  delay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
  direction = 'up'
}: AnimatedCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-30px' })

  const directionOffset = {
    up: { y: 20, x: 0 },
    down: { y: -20, x: 0 },
    left: { y: 0, x: 20 },
    right: { y: 0, x: -20 },
  }

  const offset = directionOffset[direction]

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// AnimatedGauge - Complete animated gauge
// ============================================
interface AnimatedGaugeProps {
  score: number
  label: string
  sublabel: string
  colorClass: string
  size?: 'sm' | 'md'
  delay?: number
}

export function AnimatedGauge({
  score,
  label,
  sublabel,
  colorClass,
  size = 'md',
  delay = 0,
}: AnimatedGaugeProps) {
  const percentage = (score / 10) * 100
  const gaugeSize = size === 'sm' ? 56 : 72
  const strokeWidth = size === 'sm' ? 5 : 6

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
        <AnimatedProgress
          percentage={percentage}
          size={gaugeSize}
          strokeWidth={strokeWidth}
          colorClass={colorClass}
          delay={delay + 0.2}
          duration={1.0}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedNumber
            value={score}
            decimals={1}
            delay={delay + 0.3}
            duration={1.0}
            className={cn('font-bold', size === 'sm' ? 'text-lg' : 'text-xl')}
          />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: delay + 0.4 }}
      >
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </motion.div>
    </motion.div>
  )
}

// ============================================
// AnimatedBadge - Pop-in badge animation
// ============================================
interface AnimatedBadgeProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export function AnimatedBadge({ children, className, delay = 0 }: AnimatedBadgeProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay,
        type: 'spring',
        stiffness: 500,
        damping: 25,
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// StaggerContainer - For staggered children
// ============================================
interface StaggerContainerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  initialDelay?: number
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0
}: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export const staggerItem = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
}
