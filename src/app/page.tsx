import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Pre-Validation Research
          <br />
          <span className="text-blue-600">In Minutes, Not Weeks</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          Enter your business hypothesis and get automated market research: pain signals from Reddit,
          competitor landscape analysis, and a prioritized interview guide.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="px-8">
              Start Free Research
            </Button>
          </Link>
          <Link href="#how-it-works">
            <Button variant="outline" size="lg">
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-gray-50 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Enter Your Hypothesis</h3>
              <p className="text-gray-600">
                Describe your business idea in one sentence, like &quot;Training community for London Hyrox athletes&quot;
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Analyzes the Market</h3>
              <p className="text-gray-600">
                Our AI scrapes Reddit for pain signals, analyzes competitors, and identifies key opportunities
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Actionable Insights</h3>
              <p className="text-gray-600">
                Receive a complete research report with interview questions in about 5 minutes
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">What You Get</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Community Voice Mining</h3>
              <p className="text-gray-600">
                Real pain points extracted from Reddit discussions, categorized by intensity and relevance
              </p>
            </div>
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Competitor Intelligence</h3>
              <p className="text-gray-600">
                Overview of existing solutions with their strengths, weaknesses, and market positioning
              </p>
            </div>
            <div className="border rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">Interview Guide</h3>
              <p className="text-gray-600">
                Prioritized questions to validate your hypothesis through customer interviews
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Validate Your Idea?
          </h2>
          <p className="text-blue-100 mb-8 max-w-xl mx-auto">
            Stop guessing. Get data-driven insights about your market in minutes.
          </p>
          <Link href="/login">
            <Button size="lg" variant="secondary" className="px-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} PVRE. Pre-Validation Research Engine.</p>
        </div>
      </footer>
    </div>
  )
}
