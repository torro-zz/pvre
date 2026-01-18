'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, Target, MessageSquare, TrendingUp, Clock, FileSearch, Brain, X, Check, ChevronRight } from 'lucide-react'
import { WaitlistForm } from '@/components/waitlist-form'

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

// Check if in waitlist-only mode (UI flag - real security is in middleware)
const isWaitlistMode = process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true'

export default function Home() {
  const oldWayRef = useFadeIn()
  const newWayRef = useFadeIn()
  const featuresRef = useFadeIn()

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
              {!isWaitlistMode && (
                <>
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Sign In
                  </Link>
                  <Link href="/login">
                    <Button size="sm" className="font-medium">Get Started</Button>
                  </Link>
                </>
              )}
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
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-4 animate-fade-in"
              style={{ animationDelay: '100ms' }}
            >
              <span className="block text-foreground">Research that takes weeks.</span>
              <span className="block text-primary mt-2">
                Done in 5 minutes.
              </span>
            </h1>

            {/* Who this is for */}
            <p
              className="text-base sm:text-lg text-muted-foreground/80 italic max-w-xl mx-auto mb-6 animate-fade-in"
              style={{ animationDelay: '150ms' }}
            >
              For indie hackers, solo founders, and product builders who refuse to waste months building something nobody wants.
            </p>

            {/* Subheadline - value prop */}
            <p
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              Stop guessing if your idea will work. We analyze thousands of real conversations
              to find proof of demand — pain signals, market gaps, and willingness-to-pay — so
              you can build with confidence.
            </p>

            {/* CTA */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              {isWaitlistMode ? (
                <>
                  <Link href="#waitlist">
                    <Button size="lg" className="group px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                      Join the Waitlist
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    Be first to get access
                  </span>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button size="lg" className="group px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                      Run Free Research
                      <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    Free to start · No credit card required
                  </span>
                </>
              )}
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

      {/* Product Preview Section */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-background via-muted/20 to-background">
        <div className="container mx-auto px-4">
          <ProductPreview />
          <p className="text-center text-sm text-muted-foreground mt-6">
            Pain signals. Market size. Clear verdict. All in under 5 minutes.
          </p>
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
                title="Drowning in Reddit threads"
                description="Ctrl+F-ing desperately for any sign someone cares about your problem"
              />
              <PainPoint
                icon={<FileSearch className="w-5 h-5" />}
                title="50 open tabs, zero clarity"
                description="That one useful comment you found? Good luck finding it again"
              />
              <PainPoint
                icon={<Brain className="w-5 h-5" />}
                title="Interviews that teach nothing"
                description="Asking leading questions that confirm what you already believe"
              />
              <PainPoint
                icon={<X className="w-5 h-5" />}
                title="Shipping to crickets"
                description={`Zero signups. "Maybe I need more features..." No. You needed validation.`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* The Switch */}
      <section className="py-6 relative overflow-hidden border-l-4 border-emerald-500" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-emerald-500/10 to-emerald-500/5" />
        <div className="container mx-auto px-4 text-center relative">
          <p className="text-lg font-semibold text-white tracking-wide" style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.3)' }}>
            There&apos;s a better way
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
                title="Describe what you're exploring"
                description="A business hypothesis, a problem you've noticed, or an existing app you want to compete with"
                highlight="30 seconds"
              />
              <StepCard
                number="02"
                title="We mine the evidence"
                description="PVRE analyzes thousands of Reddit posts, app reviews, and competitor data to find real user frustrations and market signals"
                highlight="~5 minutes"
              />
              <StepCard
                number="03"
                title="Make an informed decision"
                description="Get a clear verdict with evidence: pain intensity, market size, competition gaps, and timing — all backed by real quotes"
                highlight="Actionable"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What You Get - Features (Bento Grid) */}
      <section
        ref={featuresRef.ref}
        className={`py-24 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30 transition-all duration-700 ${
          featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-4">Your Research Suite</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-5">
              Evidence, not assumptions
            </h2>
            <p className="text-lg text-muted-foreground">
              Four dimensions of validation to help you make confident decisions
            </p>
          </div>

          {/* Bento Grid Layout - Clean 2x2 */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pain Signals Card */}
            <FeatureCard
              icon={<MessageSquare className="w-5 h-5" />}
              iconColor="var(--community-voice)"
              title="Real Pain, Real Words"
              description="We find people describing your problem in their own words — from Reddit rants to app store complaints."
              sampleOutput={
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pain Score</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: 'var(--community-voice)' }} />
                        ))}
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="w-1.5 h-3 rounded-sm bg-border/50" />
                        ))}
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--community-voice)' }}>7.2</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">WTP Signals</span>
                    <span className="text-xs font-mono font-semibold text-emerald-500">3 found</span>
                  </div>
                </div>
              }
            />

            {/* Market Sizing Card */}
            <FeatureCard
              icon={<TrendingUp className="w-5 h-5" />}
              iconColor="#10b981"
              title="Market Sizing"
              description="TAM/SAM/SOM estimates based on real data. Know if your market is big enough before you commit."
              sampleOutput={
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-500">2.1M</div>
                    <div className="text-[10px] text-muted-foreground uppercase">TAM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-500">340K</div>
                    <div className="text-[10px] text-muted-foreground uppercase">SAM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-500">+12%</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Growth</div>
                  </div>
                </div>
              }
            />

            {/* Competition Gaps Card */}
            <FeatureCard
              icon={<Target className="w-5 h-5" />}
              iconColor="var(--competitors)"
              title="Competition Gaps"
              description="See who else is solving this problem and where they're falling short. Find your opening."
              sampleOutput={
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-lg font-bold" style={{ color: 'var(--competitors)' }}>5</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Competitors</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-500">3</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Gaps Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-500">Moderate</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Saturation</div>
                  </div>
                </div>
              }
            />

            {/* Clear Verdict Card */}
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              iconColor="var(--verdict)"
              title="Clear Verdict"
              description="A single score that weighs pain, market, competition, and timing. Plus red flags to watch."
              sampleOutput={
                <div className="flex items-center justify-between">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      backgroundColor: 'color-mix(in oklch, var(--verdict) 15%, transparent)',
                      color: 'var(--verdict)'
                    }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Proceed
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono" style={{ color: 'var(--verdict)' }}>7.2</span>
                    <span className="text-sm text-muted-foreground">/10</span>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <FAQItem
                question="How is this different from searching Reddit myself?"
                answer="You could spend 30+ hours combing through Reddit threads. PVRE analyzes thousands of posts in minutes, extracts pain signals, scores them for intensity, and identifies willingness-to-pay indicators — work that would take you days to do manually."
                defaultOpen
              />
              <FAQItem
                question="What data sources do you analyze?"
                answer="We currently analyze Reddit communities, app store reviews (Google Play & App Store), and Hacker News. We focus on places where people complain honestly about their problems — not polished marketing speak."
              />
              <FAQItem
                question="How accurate is the market sizing?"
                answer="Our market sizing uses Fermi estimation — the same technique VCs use for back-of-envelope calculations. We're transparent about confidence levels and always show our methodology. These are educated estimates, not guarantees."
              />
              <FAQItem
                question="Is my idea kept private?"
                answer="Yes. Your research hypotheses are private to your account. We don't share, sell, or expose your ideas to anyone."
              />
              <FAQItem
                question="What if the research isn't useful?"
                answer="We offer a satisfaction guarantee. If your research doesn't provide actionable insights, contact us and we'll refund your credits — no questions asked."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="waitlist" className="py-28 relative overflow-hidden scroll-mt-20">
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
              Your idea deserves real data.
            </h2>

            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Every week you spend building without validation is a week you might be wasting.
              Be the first to know when we launch.
            </p>

            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="font-bold text-lg text-foreground">PVRE</div>
            <div className="flex items-center gap-6">
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Pre-Validation Research Engine
              </p>
            </div>
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

// Feature card component for bento grid
function FeatureCard({
  icon,
  iconColor,
  title,
  description,
  sampleOutput
}: {
  icon: React.ReactNode
  iconColor: string
  title: string
  description: string
  sampleOutput: React.ReactNode
}) {
  return (
    <div className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity"
        style={{
          background: `linear-gradient(135deg, ${iconColor} 0%, transparent 50%)`
        }}
      />

      <div className="relative p-6 h-full flex flex-col">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{
            backgroundColor: `color-mix(in oklch, ${iconColor} 12%, transparent)`,
            color: iconColor
          }}
        >
          {icon}
        </div>

        {/* Title & Description */}
        <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">
          {description}
        </p>

        {/* Sample Output */}
        <div className="pt-4 border-t border-border/50">
          {sampleOutput}
        </div>
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

// Product Preview - Stylized mockup of results
function ProductPreview() {
  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Browser frame */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
        {/* Browser header */}
        <div className="bg-muted/50 border-b border-border/40 px-4 py-3 flex items-center gap-3">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
            <div className="w-3 h-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 bg-background/50 rounded-lg px-4 py-1.5 text-xs text-muted-foreground font-mono">
            pvre.app/research/results
          </div>
        </div>

        {/* Results preview content */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-background to-muted/20">
          {/* Investor Metrics Row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            <MetricPill label="Pain" value="7.4" sublabel="Strong" color="var(--community-voice)" />
            <MetricPill label="Signals" value="23" sublabel="found" color="var(--community-voice)" />
            <MetricPill label="WTP" value="4" sublabel="found" color="#10b981" />
            <MetricPill label="Market" value="2.1M" sublabel="users" color="#10b981" />
            <MetricPill label="Timing" value="7.8" sublabel="Rising ↑" color="var(--competitors)" />
            <MetricPill label="Verdict" value="7.2" sublabel="Promising" color="var(--verdict)" highlight />
          </div>

          {/* Key Insight */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">Key Insight</div>
            <p className="text-sm text-foreground">
              Strong pain signals detected with 4 explicit willingness-to-pay indicators.
              Market is growing but competition is moderate — good timing for entry.
            </p>
          </div>

          {/* Bottom row: Verdict + Quick stats */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl font-bold text-sm" style={{ backgroundColor: 'color-mix(in oklch, var(--verdict) 15%, transparent)', color: 'var(--verdict)' }}>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  PROMISING SIGNAL
                </span>
              </div>
              <span className="text-2xl font-bold font-mono" style={{ color: 'var(--verdict)' }}>7.2</span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>23 pain signals</span>
              <span>•</span>
              <span>4 WTP indicators</span>
              <span>•</span>
              <span>3 subreddits analyzed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-transparent to-chart-2/10 rounded-3xl blur-2xl -z-10 opacity-60" />
    </div>
  )
}

// Metric pill for product preview
function MetricPill({
  label,
  value,
  sublabel,
  color,
  highlight = false
}: {
  label: string
  value: string
  sublabel?: string
  color: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 text-center ${highlight ? 'ring-2 ring-offset-2 ring-offset-background' : ''}`} style={{
      backgroundColor: `color-mix(in oklch, ${color} 10%, transparent)`,
      ...(highlight && { ringColor: color })
    }}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-sm sm:text-base font-bold font-mono" style={{ color }}>{value}</div>
      {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</div>}
    </div>
  )
}

// FAQ Item component with accordion
function FAQItem({
  question,
  answer,
  defaultOpen = false
}: {
  question: string
  answer: string
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium text-foreground pr-4">{question}</span>
        <span className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  )
}
