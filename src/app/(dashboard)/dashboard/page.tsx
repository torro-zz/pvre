import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Clock, ArrowRight, FileText, CheckCircle2, Loader2, XCircle, TrendingUp, Target, Hourglass, Users, Play, RefreshCw, Sparkles } from 'lucide-react'
import { StepStatusMap, DEFAULT_STEP_STATUS } from '@/types/database'
import { ResearchJobList } from '@/components/dashboard/research-job-list'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  step_status: StepStatusMap | null
  created_at: string
  updated_at: string
}

// Get the next incomplete step for a job
function getNextIncompleteStep(stepStatus: StepStatusMap | null): {
  step: keyof StepStatusMap | null
  label: string
  icon: React.ReactNode
} | null {
  const status = stepStatus || DEFAULT_STEP_STATUS

  const steps: Array<{
    key: keyof StepStatusMap
    label: string
    icon: React.ReactNode
  }> = [
    { key: 'pain_analysis', label: 'Pain Analysis', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'market_sizing', label: 'Market Sizing', icon: <Target className="h-4 w-4" /> },
    { key: 'timing_analysis', label: 'Timing Analysis', icon: <Hourglass className="h-4 w-4" /> },
    { key: 'competitor_analysis', label: 'Competitor Analysis', icon: <Users className="h-4 w-4" /> },
  ]

  for (const step of steps) {
    const stepState = status[step.key]
    if (stepState === 'pending' || stepState === 'in_progress' || stepState === 'failed') {
      return { step: step.key, label: step.label, icon: step.icon }
    }
  }

  // All steps completed
  return null
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch user's research jobs
  const { data: jobs } = await supabase
    .from('research_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const researchJobs = (jobs || []) as ResearchJob[]

  // Find any currently processing jobs (for the "In Progress" banner)
  const STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
  const now = Date.now()

  const processingJobs = researchJobs.filter(job => {
    if (job.status !== 'processing') return false
    const updatedAt = new Date(job.updated_at).getTime()
    return (now - updatedAt) < STALE_THRESHOLD_MS
  })

  // Find the most recent job that has incomplete steps
  const incompleteJob = researchJobs.find(job => {
    if (job.status === 'failed') return false
    const nextStep = getNextIncompleteStep(job.step_status)
    return nextStep !== null
  })

  const nextStep = incompleteJob ? getNextIncompleteStep(incompleteJob.step_status) : null

  return (
    <div className="space-y-8">
      {/* Header with greeting */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Get automated market research for your business hypothesis
        </p>
      </div>

      {/* In Progress Research Banner */}
      {processingJobs.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/20">
                  <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Research in progress
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    "{truncateText(processingJobs[0].hypothesis, 50)}"
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/research/${processingJobs[0].id}`}>
                  <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10">
                    View Progress
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="sm" variant="ghost" className="text-blue-700 dark:text-blue-300" title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hero: Start New Research */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
          <CardHeader className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Start New Research</CardTitle>
            </div>
            <CardDescription>
              Validate your business hypothesis with AI-powered analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-muted-foreground">Pain Score</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20">
                  <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-muted-foreground">Market Size</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20">
                  <Hourglass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-muted-foreground">Timing</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-500/20">
                  <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-muted-foreground">Competition</span>
              </div>
            </div>
            <Link href="/research">
              <Button className="w-full" size="lg">
                Start Research
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Continue Your Research (only if incomplete job) */}
        {incompleteJob && nextStep && (
          <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Play className="h-5 w-5 text-primary" />
                <CardTitle>Continue Your Research</CardTitle>
              </div>
              <CardDescription>
                Next step: <span className="font-medium text-foreground">{nextStep.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground font-medium line-clamp-2">
                "{truncateText(incompleteJob.hypothesis, 80)}"
              </p>
              <Link href={`/research/${incompleteJob.id}`} className="block">
                <Button className="w-full" variant="default">
                  {nextStep.icon}
                  <span className="ml-2">Continue to {nextStep.label}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* If no incomplete job, show a placeholder or tips card */}
        {!incompleteJob && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Research Tips</CardTitle>
              </div>
              <CardDescription>
                Get the most out of your research
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                <span>Be specific about your target audience</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                <span>Include the problem you're solving</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" />
                <span>Run competitor analysis for full insights</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Research */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Research
              </CardTitle>
              <CardDescription>
                Your latest research projects
              </CardDescription>
            </div>
            {researchJobs.length > 0 && (
              <Link href="/account/usage">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ResearchJobList jobs={researchJobs} />
        </CardContent>
      </Card>
    </div>
  )
}
