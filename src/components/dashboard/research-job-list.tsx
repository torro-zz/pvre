'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, ArrowRight, CheckCircle2, Loader2, XCircle, TrendingUp, Target, Hourglass, Users, BarChart3 } from 'lucide-react'
import { StepStatusMap, DEFAULT_STEP_STATUS } from '@/types/database'

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
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-950">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case 'processing':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-950">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-950">
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

interface ResearchJobListProps {
  jobs: ResearchJob[]
}

export function ResearchJobList({ jobs }: ResearchJobListProps) {
  const router = useRouter()
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [compareMode, setCompareMode] = useState(false)

  // Only completed jobs can be compared
  const comparableJobs = jobs.filter(job => job.status === 'completed')
  const canCompare = comparableJobs.length >= 2

  const toggleJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
      // Max 4 jobs
      if (newSelected.size >= 4) return
      newSelected.add(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const handleCompare = () => {
    if (selectedJobs.size < 2) return
    const jobIds = Array.from(selectedJobs).join(',')
    router.push(`/comparison?jobs=${jobIds}`)
  }

  const exitCompareMode = () => {
    setCompareMode(false)
    setSelectedJobs(new Set())
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          No research projects yet. Start your first one above!
        </p>
        <Link href="/research">
          <Button variant="outline">
            Start Your First Research
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Compare Mode Controls */}
      {canCompare && (
        <div className="flex items-center justify-between pb-2">
          {compareMode ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedJobs.size} of 4 selected
              </span>
              <Button
                size="sm"
                onClick={handleCompare}
                disabled={selectedJobs.size < 2}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Compare ({selectedJobs.size})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={exitCompareMode}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompareMode(true)}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Compare Hypotheses
            </Button>
          )}
        </div>
      )}

      {/* Job List */}
      {jobs.map((job) => {
        const jobNextStep = getNextIncompleteStep(job.step_status)
        const isFullyCompleted = jobNextStep === null
        const isClickable = job.status !== 'failed'
        const isComparable = job.status === 'completed'
        const isSelected = selectedJobs.has(job.id)

        const href = isClickable ? `/research/${job.id}` : '#'

        const handleRowClick = (e: React.MouseEvent) => {
          if (compareMode && isComparable) {
            e.preventDefault()
            toggleJob(job.id)
          }
        }

        return (
          <div
            key={job.id}
            className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
              isSelected ? 'bg-primary/5 border-primary/50' : 'hover:bg-muted/50'
            } ${compareMode && !isComparable ? 'opacity-50' : ''}`}
          >
            {/* Checkbox (only in compare mode) */}
            {compareMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleJob(job.id)}
                disabled={!isComparable || (!isSelected && selectedJobs.size >= 4)}
                className="shrink-0"
              />
            )}

            {/* Job content - clickable */}
            <Link
              href={compareMode ? '#' : href}
              onClick={handleRowClick}
              className={`flex-1 flex items-center justify-between min-w-0 ${
                !isClickable && !compareMode ? 'cursor-default' : ''
              } ${compareMode ? 'cursor-pointer' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {truncateText(job.hypothesis, 60)}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(job.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {isFullyCompleted ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-950">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : job.status === 'failed' ? (
                  getStatusBadge(job.status)
                ) : jobNextStep ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    {jobNextStep.icon}
                    <span className="ml-1">{jobNextStep.label}</span>
                  </Badge>
                ) : (
                  getStatusBadge(job.status)
                )}
                {isClickable && !compareMode && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Link>
          </div>
        )
      })}

      {/* Compare hint when not enough jobs */}
      {!canCompare && jobs.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Complete at least 2 research projects to compare them
        </p>
      )}
    </div>
  )
}
