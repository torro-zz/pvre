'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, Target, MessageSquare, TrendingUp, Clock, FileSearch, Brain, X, Check, ChevronRight } from 'lucide-react'

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

export default function Home() {
  const oldWayRef = useFadeIn()
  const newWayRef = useFadeIn()
  const featuresRef = useFadeIn()
  const testimonialsRef = useFadeIn()

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Public Navigation */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="font-bold text-xl text-foreground tracking-tight">
              PVRE
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link href="/login">
                <Button size="sm" className="font-medium">Get Started</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section - Pain-Focused with Floating Proof */}
      <section className="relative min-h-[85vh] flex items-center">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-primary/8 via-primary/4 to-transparent rounded-full blur-3xl animate-pulse-slow"
          />
          <div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-chart-2/8 via-chart-2/4 to-transparent rounded-full blur-3xl animate-pulse-slow"
            style={{ animationDelay: '2s' }}
          />
        </div>

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow with urgency */}
            <div
              className="inline-flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
              </span>
              <span className="text-sm font-medium text-destructive">90% of startups fail from building the wrong thing</span>
            </div>

            {/* Pain-focused headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '100ms' }}
            >
              <span className="block text-foreground">Know if your idea has legs</span>
              <span className="block text-primary mt-2">
                in 5 minutes, not 5 weeks
              </span>
            </h1>

            {/* Subheadline - value prop */}
            <p
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              Enter your business hypothesis. Get real pain signals from Reddit,
              competitive analysis, and a go/no-go verdict — automatically.
            </p>

            {/* CTA */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              <Link href="/login">
                <Button size="lg" className="group px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                  Run Free Research
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Free to start · No credit card required
              </span>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
          </div>
        </div>
      </section>

      {/* The Old Way - Problem Section */}
      <section
        ref={oldWayRef.ref}
        className={`py-24 bg-muted/40 border-y border-border/50 transition-all duration-700 ${
          oldWayRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <span className="inline-block text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">The Old Way</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                Manual validation is a time sink
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <PainPoint
                icon={<Clock className="w-5 h-5" />}
                title="30+ hours browsing Reddit"
                description="Manually searching forums, saving posts, trying to find patterns"
              />
              <PainPoint
                icon={<FileSearch className="w-5 h-5" />}
                title="Scattered notes everywhere"
                description="Insights buried in random docs, spreadsheets, and bookmarks"
              />
              <PainPoint
                icon={<Brain className="w-5 h-5" />}
                title="Guessing what to ask"
                description="Running interviews without knowing the right questions"
              />
              <PainPoint
                icon={<X className="w-5 h-5" />}
                title="Building for months, then..."
                description="Discovering nobody actually wants what you built"
              />
            </div>
          </div>
        </div>
      </section>

      {/* The Switch */}
      <section className="py-6 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-primary" />
        <div className="container mx-auto px-4 text-center relative">
          <p className="text-lg font-semibold flex items-center justify-center gap-3">
            <span>There&apos;s a better way</span>
            <ChevronRight className="w-5 h-5 animate-pulse" />
          </p>
        </div>
      </section>

      {/* The New Way - How It Works */}
      <section
        id="how-it-works"
        ref={newWayRef.ref}
        className={`py-24 transition-all duration-700 ${
          newWayRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4">The New Way</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                From hypothesis to insights in 3 steps
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-10">
              <StepCard
                number="01"
                title="Describe your idea"
                description="Enter a business hypothesis like 'Meal prep service for busy parents who hate cooking'"
                highlight="30 seconds"
              />
              <StepCard
                number="02"
                title="AI does the research"
                description="We scan 12,000+ Reddit posts, identify competitors, and score real pain signals"
                highlight="~5 minutes"
              />
              <StepCard
                number="03"
                title="Get your verdict"
                description="Receive a go/no-go recommendation with interview questions to validate further"
                highlight="Actionable"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What You Get - Features */}
      <section
        ref={featuresRef.ref}
        className={`py-24 bg-muted/40 border-y border-border/50 transition-all duration-700 ${
          featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5">
              What you get
            </h2>
            <p className="text-lg text-muted-foreground">
              Three modules that turn guesswork into evidence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              title="Community Voice Mining"
              description="Real pain points from Reddit discussions. See intensity scores, willingness-to-pay signals, and the exact words customers use."
              accentColor="var(--community-voice)"
              sample="Pain Score: 7.2/10 · 3 WTP signals"
            />
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              title="Competitor Intelligence"
              description="Map existing solutions. Discover market gaps, positioning opportunities, and threats — all analyzed by AI."
              accentColor="var(--competitors)"
              sample="4 direct competitors · 2 gaps"
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              title="Go/No-Go Verdict"
              description="Clear recommendation based on pain intensity and competition. Know whether to proceed, pivot, or pass."
              accentColor="var(--verdict)"
              sample="Verdict: Proceed · Score: 6.8/10"
            />
          </div>
        </div>
      </section>

      {/* Social Proof - Testimonials */}
      <section
        ref={testimonialsRef.ref}
        className={`py-24 transition-all duration-700 ${
          testimonialsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                What founders are saying
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <TestimonialCard
                quote="I was about to spend 3 months building. PVRE showed me in 30 minutes that my target market was way smaller than I thought. Saved me from a costly mistake."
                name="Marcus R."
                role="Solo Founder"
              />
              <TestimonialCard
                quote="The pain signals feature is incredible. I found exact quotes from my target customers that I now use in my landing page copy. Worth it for that alone."
                name="Sarah K."
                role="First-time Founder"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-primary/10 via-transparent to-chart-2/10 rounded-full blur-3xl opacity-50"
        />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-8">
              <Zap className="w-7 h-7 text-primary" />
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5">
              Stop guessing. Start validating.
            </h2>

            <p className="text-lg text-muted-foreground mb-10">
              Your next idea deserves real evidence, not gut feelings.
              Find out if it has legs — in the next 5 minutes.
            </p>

            <Link href="/login">
              <Button size="lg" className="group px-10 h-14 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                Run Free Research
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>

            <p className="text-sm text-muted-foreground mt-5">
              No credit card required · Results in ~5 minutes
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-bold text-lg text-foreground">PVRE</div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Pre-Validation Research Engine
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Pain point component
function PainPoint({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 p-5 bg-background border border-border/60 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// Step card component
function StepCard({
  number,
  title,
  description,
  highlight
}: {
  number: string
  title: string
  description: string
  highlight: string
}) {
  return (
    <div className="text-center md:text-left">
      <div className="text-6xl font-bold text-primary/15 font-mono mb-4">{number}</div>
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
        <Check className="w-3.5 h-3.5" />
        {highlight}
      </div>
      <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

// Feature card component
function FeatureCard({
  icon,
  title,
  description,
  accentColor,
  sample
}: {
  icon: React.ReactNode
  title: string
  description: string
  accentColor: string
  sample: string
}) {
  return (
    <div
      className="group relative bg-card border border-border/60 rounded-2xl p-7 transition-all duration-300 hover:border-border hover:shadow-xl hover:-translate-y-1"
      style={{
        borderLeftColor: accentColor,
        borderLeftWidth: '4px'
      }}
    >
      <div
        className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
        style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 12%, transparent)` }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
      </div>

      <h3 className="text-xl font-semibold mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed mb-5">{description}</p>

      {/* Sample output */}
      <div
        className="text-xs font-mono px-4 py-2.5 rounded-lg border"
        style={{
          backgroundColor: `color-mix(in oklch, ${accentColor} 5%, transparent)`,
          borderColor: `color-mix(in oklch, ${accentColor} 20%, transparent)`,
          color: accentColor
        }}
      >
        {sample}
      </div>
    </div>
  )
}

// Testimonial card component
function TestimonialCard({
  quote,
  name,
  role
}: {
  quote: string
  name: string
  role: string
}) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-7 shadow-sm hover:shadow-lg transition-shadow">
      <p className="text-foreground leading-relaxed mb-6 text-lg">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center text-primary font-bold text-lg">
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{role}</div>
        </div>
      </div>
    </div>
  )
}
