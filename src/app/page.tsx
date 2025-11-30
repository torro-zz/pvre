'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { ArrowRight, Zap, Target, MessageSquare, TrendingUp, Sparkles } from 'lucide-react'

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(!startOnView)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true)
          }
        },
        { threshold: 0.5 }
      )
      observer.observe(ref.current)
      return () => observer.disconnect()
    }
  }, [startOnView, hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * end))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  }, [end, duration, hasStarted])

  return { count, ref }
}

// Scroll-triggered fade in
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// Floating badge component for hero
function FloatingBadge({
  children,
  className = '',
  delay = 0
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div
      className={`absolute bg-white/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-lg animate-float ${className}`}
      style={{
        animationDelay: `${delay}ms`,
        animationDuration: '3s'
      }}
    >
      {children}
    </div>
  )
}

export default function Home() {
  const featuresRef = useFadeIn()
  const statsRef = useFadeIn()
  const signalsCounter = useAnimatedCounter(847, 2000)
  const insightsCounter = useAnimatedCounter(12, 1500)

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />

      {/* Hero Section */}
      <section className="relative">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Gradient orb */}
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-primary/5 via-primary/10 to-transparent rounded-full blur-3xl" />

        <div className="container mx-auto px-4 pt-20 pb-32 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-full px-4 py-1.5 mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Market Research</span>
            </div>

            {/* Main headline */}
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '100ms' }}
            >
              <span className="block text-foreground">Validate ideas</span>
              <span className="block bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                before you build
              </span>
            </h1>

            {/* Subheadline */}
            <p
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              Enter your business hypothesis. Get real pain signals from Reddit,
              competitive analysis, and interview questions — in minutes, not weeks.
            </p>

            {/* CTA */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              <Link href="/login">
                <Button size="lg" className="group px-8 h-12 text-base font-medium">
                  Start researching
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Free to start · No credit card required
              </span>
            </div>
          </div>

          {/* Floating proof elements */}
          <div className="hidden lg:block">
            <FloatingBadge className="top-32 left-[8%]" delay={500}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-foreground">Pain signal found</span>
              </div>
            </FloatingBadge>

            <FloatingBadge className="top-48 right-[5%]" delay={800}>
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <span className="text-xs font-medium text-foreground">WTP: High confidence</span>
              </div>
            </FloatingBadge>

            <FloatingBadge className="bottom-24 left-[12%]" delay={1100}>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">3 competitors identified</span>
              </div>
            </FloatingBadge>

            <FloatingBadge className="bottom-40 right-[10%]" delay={1400}>
              <div className="text-xs">
                <span className="text-muted-foreground">Pain Score:</span>
                <span className="ml-1 font-mono font-bold text-foreground">7.2/10</span>
              </div>
            </FloatingBadge>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section
        ref={statsRef.ref}
        className={`border-y border-border/50 bg-muted/30 py-8 transition-all duration-700 ${
          statsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground font-mono">
                <span ref={signalsCounter.ref}>{signalsCounter.count}</span>+
              </div>
              <div className="text-sm text-muted-foreground mt-1">Pain signals analyzed</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground font-mono">
                <span ref={insightsCounter.ref}>{insightsCounter.count}</span>k+
              </div>
              <div className="text-sm text-muted-foreground mt-1">Reddit posts processed</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground font-mono">~5min</div>
              <div className="text-sm text-muted-foreground mt-1">Average research time</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        ref={featuresRef.ref}
        className="py-24 relative"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2
              className={`text-3xl sm:text-4xl font-bold mb-4 transition-all duration-700 ${
                featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              Everything you need to validate
            </h2>
            <p
              className={`text-lg text-muted-foreground transition-all duration-700 delay-100 ${
                featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              Three powerful modules that turn your hypothesis into actionable insights
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              title="Community Voice Mining"
              description="Extract real pain points from Reddit. Intensity scoring, WTP signals, and the exact words your customers use."
              accentColor="var(--community-voice)"
              delay={0}
              isVisible={featuresRef.isVisible}
            />

            {/* Feature 2 */}
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              title="Competitor Intelligence"
              description="Map the competitive landscape. Discover gaps, threats, and positioning opportunities with AI analysis."
              accentColor="var(--competitors)"
              delay={100}
              isVisible={featuresRef.isVisible}
            />

            {/* Feature 3 */}
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              title="MVP Viability Verdict"
              description="Get a clear go/no-go recommendation based on pain intensity, market demand, and competitive dynamics."
              accentColor="var(--verdict)"
              delay={200}
              isVisible={featuresRef.isVisible}
            />
          </div>
        </div>
      </section>

      {/* How it works - minimal */}
      <section className="py-24 bg-muted/30 border-y border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
              From hypothesis to insights in three steps
            </h2>

            <div className="grid md:grid-cols-3 gap-12">
              <StepItem
                number="01"
                title="Describe your idea"
                description="Enter a business hypothesis like 'Meal prep service for busy parents'"
              />
              <StepItem
                number="02"
                title="AI analyzes markets"
                description="We scan Reddit, identify competitors, and score pain signals"
              />
              <StepItem
                number="03"
                title="Get your verdict"
                description="Receive actionable insights and interview questions to validate further"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-6">
              <Zap className="w-6 h-6 text-primary" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Stop guessing. Start validating.
            </h2>

            <p className="text-lg text-muted-foreground mb-8">
              Join entrepreneurs who validate their ideas with real market data
              before investing months building the wrong thing.
            </p>

            <Link href="/login">
              <Button size="lg" className="group px-8 h-12 text-base font-medium">
                Start your first research
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-semibold text-foreground">PVRE</div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Pre-Validation Research Engine
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Feature card component
function FeatureCard({
  icon,
  title,
  description,
  accentColor,
  delay,
  isVisible
}: {
  icon: React.ReactNode
  title: string
  description: string
  accentColor: string
  delay: number
  isVisible: boolean
}) {
  return (
    <div
      className={`group relative bg-card border border-border/50 rounded-xl p-6 transition-all duration-500 hover:border-border hover:shadow-lg hover:-translate-y-1 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{
        transitionDelay: `${delay}ms`,
        borderLeftColor: accentColor,
        borderLeftWidth: '3px'
      }}
    >
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 transition-colors"
        style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 15%, transparent)` }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
      </div>

      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}

// Step item component
function StepItem({
  number,
  title,
  description
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="text-center md:text-left">
      <div className="text-5xl font-bold text-primary/20 font-mono mb-3">{number}</div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}
