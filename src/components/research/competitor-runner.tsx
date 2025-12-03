'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Shield, Loader2, AlertCircle, Plus, X, CheckCircle2, TrendingUp, PieChart, Timer } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CompetitorRunnerProps {
  jobId: string
  hypothesis: string
}

interface ProgressStep {
  label: string
  status: 'pending' | 'active' | 'complete'
}

export function CompetitorRunner({ jobId, hypothesis }: CompetitorRunnerProps) {
  const router = useRouter()
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [knownCompetitors, setKnownCompetitors] = useState<string[]>([])
  const [competitorInput, setCompetitorInput] = useState('')

  const addCompetitor = () => {
    const trimmed = competitorInput.trim()
    if (trimmed && !knownCompetitors.includes(trimmed)) {
      setKnownCompetitors([...knownCompetitors, trimmed])
      setCompetitorInput('')
    }
  }

  const removeCompetitor = (index: number) => {
    setKnownCompetitors(knownCompetitors.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addCompetitor()
    }
  }

  const runCompetitorAnalysis = async () => {
    setIsRunning(true)
    setError(null)
    setProgress(0)
    setProgressSteps([
      { label: 'Analyzing market landscape', status: 'active' },
      { label: 'Identifying competitors', status: 'pending' },
      { label: 'Evaluating positioning', status: 'pending' },
      { label: 'Finding opportunities', status: 'pending' },
    ])

    try {
      const response = await fetch('/api/research/competitor-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypothesis,
          jobId,
          knownCompetitors,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.error === 'insufficient_credits') {
          throw new Error('You need credits to run competitor analysis. Please purchase a credit pack.')
        }
        throw new Error(data.error || 'Failed to run competitor analysis')
      }

      // Simulate progress since this endpoint isn't streaming
      for (let i = 1; i <= 4; i++) {
        setProgress(i * 25)
        setProgressSteps(prev => prev.map((step, idx) => ({
          ...step,
          status: idx < i ? 'complete' : idx === i ? 'active' : 'pending'
        })))
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Refresh the page to show results
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsRunning(false)
    }
  }

  if (isRunning) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <Shield className="h-12 w-12 text-primary mx-auto animate-pulse" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Running Competitor Analysis</h3>
              <p className="text-muted-foreground mb-4">
                Analyzing the competitive landscape for your hypothesis...
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <Progress value={progress} className="h-2" />
              <div className="space-y-2">
                {progressSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {step.status === 'active' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {step.status === 'complete' && <Shield className="h-4 w-4 text-green-500" />}
                    {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                    <span className={step.status === 'active' ? 'text-primary font-medium' : step.status === 'complete' ? 'text-muted-foreground' : 'text-muted-foreground/50'}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Completion Status Banner */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900 mb-2">Research Progress Complete</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <TrendingUp className="h-4 w-4" />
                  <span>Pain Analysis</span>
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-2 text-green-700">
                  <PieChart className="h-4 w-4" />
                  <span>Market Sizing</span>
                  <CheckCircle2 className="h-3 w-3" />
                </div>
                <div className="flex items-center gap-2 text-green-700">
                  <Timer className="h-4 w-4" />
                  <span>Timing Analysis</span>
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-8">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Complete Your Research</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Run Competitor Intelligence to finalize your research verdict.
              </p>
              <p className="text-xs text-muted-foreground bg-muted inline-block px-3 py-1 rounded-full">
                Included with your research credit - no extra charge
              </p>
            </div>

          {/* Known Competitors Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Known Competitors (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Peloton, CrossFit, F45..."
                value={competitorInput}
                onChange={(e) => setCompetitorInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addCompetitor}
                disabled={!competitorInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Added Competitors List */}
            {knownCompetitors.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {knownCompetitors.map((competitor, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {competitor}
                    <button
                      type="button"
                      onClick={() => removeCompetitor(idx)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4 text-left">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={runCompetitorAnalysis} className="w-full">
            <Shield className="h-4 w-4 mr-2" />
            Run Competitor Intelligence
            {knownCompetitors.length > 0 && (
              <span className="ml-2 text-xs opacity-75">
                (+{knownCompetitors.length} known)
              </span>
            )}
          </Button>
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
