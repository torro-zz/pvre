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
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="font-bold text-xl text-foreground">
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
                <Button size="sm">Get Started</Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section - Pain-Focused */}
      <section className="relative">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />

        <div className="container mx-auto px-4 pt-20 pb-16 relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Eyebrow with urgency */}
            <div className="inline-flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-full px-4 py-1.5 mb-8 animate-fade-in">
              <span className="text-sm font-medium text-destructive">90% of startups fail from building the wrong thing</span>
            </div>

            {/* Pain-focused headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '100ms' }}
            >
              <span className="block text-foreground">Know if your idea has legs</span>
              <span className="block text-primary mt-2">
                in 5 minutes, not 5 weeks
              </span>
            </h1>

            {/* Subheadline - value prop */}
            <p
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
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
                <Button size="lg" className="group px-8 h-12 text-base font-medium">
                  Run Free Research
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Free to start · No credit card required
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* The Old Way - Problem Section */}
      <section
        ref={oldWayRef.ref}
        className={`py-20 bg-muted/30 border-y border-border/50 transition-all duration-700 ${
          oldWayRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">The Old Way</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3 text-foreground">
                Manual validation is a time sink
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
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
      <section className="py-8 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg font-medium flex items-center justify-center gap-3">
            <span>There&apos;s a better way</span>
            <ChevronRight className="w-5 h-5" />
          </p>
        </div>
      </section>

      {/* The New Way - How It Works */}
      <section
        id="how-it-works"
        ref={newWayRef.ref}
        className={`py-20 transition-all duration-700 ${
          newWayRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-sm font-medium text-primary uppercase tracking-wider">The New Way</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                From hypothesis to insights in 3 steps
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
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
        className={`py-20 bg-muted/30 border-y border-border/50 transition-all duration-700 ${
          featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
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
              sample="Sample output: 'Pain Score: 7.2/10 · 3 WTP signals found'"
            />
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              title="Competitor Intelligence"
              description="Map existing solutions. Discover market gaps, positioning opportunities, and threats — all analyzed by AI."
              accentColor="var(--competitors)"
              sample="Sample output: '4 direct competitors · 2 underserved gaps'"
            />
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              title="Go/No-Go Verdict"
              description="Clear recommendation based on pain intensity and competition. Know whether to proceed, pivot, or pass."
              accentColor="var(--verdict)"
              sample="Sample output: 'Verdict: Proceed with caution · Score: 6.8/10'"
            />
          </div>
        </div>
      </section>

      {/* Social Proof - Testimonials */}
      <section
        ref={testimonialsRef.ref}
        className={`py-20 transition-all duration-700 ${
          testimonialsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">
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
              Your next idea deserves real evidence, not gut feelings.
              Find out if it has legs — in the next 5 minutes.
            </p>

            <Link href="/login">
              <Button size="lg" className="group px-8 h-12 text-base font-medium">
                Run Free Research
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>

            <p className="text-sm text-muted-foreground mt-4">
              No credit card required · Results in ~5 minutes
            </p>
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
    <div className="flex items-start gap-4 p-4 bg-background border border-border/50 rounded-lg">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
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
      <div className="text-5xl font-bold text-primary/20 font-mono mb-3">{number}</div>
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded mb-3">
        <Check className="w-3 h-3" />
        {highlight}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
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
      className="group relative bg-card border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-border hover:shadow-lg"
      style={{
        borderLeftColor: accentColor,
        borderLeftWidth: '3px'
      }}
    >
      <div
        className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4"
        style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 15%, transparent)` }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
      </div>

      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{description}</p>

      {/* Sample output */}
      <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-3 py-2 rounded border border-border/50">
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
    <div className="bg-card border border-border/50 rounded-xl p-6">
      <p className="text-foreground leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-foreground text-sm">{name}</div>
          <div className="text-xs text-muted-foreground">{role}</div>
        </div>
      </div>
    </div>
  )
}
