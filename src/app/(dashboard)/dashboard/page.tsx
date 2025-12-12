import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Clock, ArrowRight, FileText, CheckCircle2, Loader2, XCircle, TrendingUp, Target, Hourglass, Users, Play, RefreshCw } from 'lucide-react'
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

function getStatusBadge(status: ResearchJob['status']) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case 'processing':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  // Only show jobs updated in the last 15 minutes as "in progress"
  // Older jobs are likely stuck and will be cleaned up by the cron job
  const STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
  const now = Date.now()

  const processingJobs = researchJobs.filter(job => {
    if (job.status !== 'processing') return false
    const updatedAt = new Date(job.updated_at).getTime()
    return (now - updatedAt) < STALE_THRESHOLD_MS
  })

  // Find the most recent job that has incomplete steps (not all 4 completed)
  const incompleteJob = researchJobs.find(job => {
    // Skip failed jobs (they can't be continued)
    if (job.status === 'failed') return false

    const nextStep = getNextIncompleteStep(job.step_status)
    return nextStep !== null
  })

  const nextStep = incompleteJob ? getNextIncompleteStep(incompleteJob.step_status) : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}!</h1>
        <p className="text-gray-600 mt-2">
          Get automated market research for your business hypothesis
        </p>
      </div>

      {/* In Progress Research Banner */}
      {processingJobs.length > 0 && (
        <Card className="border-blue-500/50 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
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
                  <Button size="sm" variant="outline" className="border-blue-500/50 text-blue-700 hover:bg-blue-500/10">
                    View Progress
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="sm" variant="ghost" className="text-blue-700" title="Refresh to check status">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Start New Research */}
        <Card>
          <CardHeader>
            <CardTitle>Start New Research</CardTitle>
            <CardDescription>
              Validate your business hypothesis with AI-powered analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span>Pain Score</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Target className="h-4 w-4 text-blue-600" />
                <span>Market Size</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hourglass className="h-4 w-4 text-amber-600" />
                <span>Timing</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-purple-600" />
                <span>Competition</span>
              </div>
            </div>
            <Link href="/research">
              <Button className="w-full">Start Research</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Card 2: Continue Your Research (only shown if there's an incomplete job) */}
        {incompleteJob && nextStep && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Continue Your Research
              </CardTitle>
              <CardDescription>
                Next step: {nextStep.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground font-medium line-clamp-2">
                "{truncateText(incompleteJob.hypothesis, 80)}"
              </p>
              <div className="flex gap-2">
                <Link href={`/research/${incompleteJob.id}`} className="flex-1">
                  <Button className="w-full">
                    {nextStep.icon}
                    <span className="ml-2">Continue to {nextStep.label}</span>
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Research
          </CardTitle>
          <CardDescription>
            Your latest research projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResearchJobList jobs={researchJobs} />
        </CardContent>
      </Card>
    </div>
  )
}
