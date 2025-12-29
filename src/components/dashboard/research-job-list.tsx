'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, ArrowRight, CheckCircle2, Loader2, XCircle, TrendingUp, Target, Hourglass, Users, BarChart3, MoreVertical, Trash2, ChevronDown, ChevronUp, FolderInput, FolderPlus, X, Lightbulb, Smartphone } from 'lucide-react'
import { FolderSelector, FolderDialog } from '@/components/folders'
import { StepStatusMap, DEFAULT_STEP_STATUS } from '@/types/database'
import { cn } from '@/lib/utils'
import type { VerdictLevel } from '@/lib/analysis/viability-calculator'

interface VerdictData {
  overallScore: number
  verdict: VerdictLevel
  painScore: number | null
  marketScore: number | null
  timingScore: number | null
}

// Coverage data stored with each research job
interface CoverageData {
  mode?: 'hypothesis' | 'app-analysis'
  appData?: {
    name: string
    store: string
    // ... other fields exist but we only need mode
  }
  // Display fields (for dashboard recognition)
  originalInput?: string   // What user typed
  shortTitle?: string      // AI-cleaned short title
  [key: string]: unknown
}

/**
 * Get display title for a research job with smart fallback logic
 * Priority: shortTitle > originalInput > smart truncation of hypothesis
 */
function getDisplayTitle(job: ResearchJob): string {
  const coverageData = job.coverage_data

  // Priority 1: Short title from AI
  if (coverageData?.shortTitle) {
    return coverageData.shortTitle
  }

  // Priority 2: Original user input
  if (coverageData?.originalInput) {
    return coverageData.originalInput
  }

  // Priority 3: App name for app-analysis mode
  if (coverageData?.mode === 'app-analysis' && coverageData?.appData?.name) {
    return coverageData.appData.name
  }

  // Priority 4: Smart truncation of hypothesis (for legacy data)
  const hypothesis = job.hypothesis

  // Try to find natural break points
  const firstWho = hypothesis.indexOf(' who ')
  if (firstWho > 0 && firstWho < 60) {
    return hypothesis.substring(0, firstWho)
  }

  const firstComma = hypothesis.indexOf(',')
  if (firstComma > 0 && firstComma < 60) {
    return hypothesis.substring(0, firstComma)
  }

  // Last resort: truncate with ellipsis
  if (hypothesis.length > 50) {
    return hypothesis.substring(0, 47) + '...'
  }

  return hypothesis
}

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  step_status: StepStatusMap | null
  folder_id: string | null
  coverage_data: CoverageData | null
  created_at: string
  updated_at: string
}

export interface ResearchJobWithVerdict extends ResearchJob {
  verdictData: VerdictData | null
}

// Update job folder via API
async function updateJobFolder(jobId: string, folderId: string | null): Promise<boolean> {
  try {
    const response = await fetch(`/api/research/jobs?id=${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
    return response.ok
  } catch (error) {
    console.error('Error updating job folder:', error)
    return false
  }
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

  return null
}

function getStatusBadge(status: ResearchJob['status']) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 border-0">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    case 'processing':
      return (
        <Badge className="bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 border-0">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-rose-500/15 text-rose-600 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 border-0">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    default:
      return (
        <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 border-0">
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

// Verdict dot indicator component
function VerdictDot({ verdict, score }: { verdict: VerdictLevel; score: number }) {
  const config = {
    strong: {
      bg: 'bg-emerald-500',
      ring: 'ring-emerald-500/30',
      label: 'Strong',
    },
    mixed: {
      bg: 'bg-amber-500',
      ring: 'ring-amber-500/30',
      label: 'Mixed',
    },
    weak: {
      bg: 'bg-orange-500',
      ring: 'ring-orange-500/30',
      label: 'Emerging',
    },
    none: {
      bg: 'bg-red-500',
      ring: 'ring-red-500/30',
      label: 'Pause',
    },
  }

  const { bg, ring, label } = config[verdict]

  return (
    <div className="flex items-center gap-1.5" title={`${label} signal (${score.toFixed(1)}/10)`}>
      <div className={cn('w-2.5 h-2.5 rounded-full ring-2', bg, ring)} />
      <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
        {score.toFixed(1)}
      </span>
    </div>
  )
}

// Research type icon with embossed styling
type ResearchType = 'hypothesis' | 'app'

function ResearchTypeIcon({ type }: { type: ResearchType }) {
  const config = {
    hypothesis: {
      icon: Lightbulb,
      label: 'Hypothesis Validation',
    },
    app: {
      icon: Smartphone,
      label: 'App Gap Analysis',
    },
  }

  const { icon: Icon, label } = config[type]

  return (
    <div
      className="shrink-0 relative group"
      title={label}
    >
      {/* Embossed container - monochromatic, subtle depth */}
      <div className={cn(
        // Base styling
        "relative w-7 h-7 rounded-lg flex items-center justify-center",
        // Embossed effect - inset shadows for depth on dark background
        "bg-muted/30",
        "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_1px_rgba(255,255,255,0.05)]",
        // Subtle border for definition
        "border border-border/30",
        // Hover effect - slightly lift
        "transition-all duration-200 ease-out",
        "group-hover:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.2),inset_-1px_-1px_2px_rgba(255,255,255,0.08)]",
        "group-hover:border-border/50"
      )}>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors" />

        {/* Subtle top-left highlight for depth */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

// Helper to determine research type from coverage_data
function getResearchType(coverageData: CoverageData | null): ResearchType {
  // Check coverage_data.mode first (most reliable)
  if (coverageData?.mode === 'app-analysis') {
    return 'app'
  }
  // Default to hypothesis
  return 'hypothesis'
}

// Mini metrics row for completed jobs
function MiniMetrics({ painScore, marketScore, timingScore }: {
  painScore: number | null
  marketScore: number | null
  timingScore: number | null
}) {
  const metrics = [
    { label: 'Pain', score: painScore, icon: TrendingUp },
    { label: 'Market', score: marketScore, icon: Target },
    { label: 'Timing', score: timingScore, icon: Hourglass },
  ].filter(m => m.score !== null)

  if (metrics.length === 0) return null

  return (
    <div className="flex items-center gap-2 mt-1">
      {metrics.map(({ label, score, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded text-xs"
          title={`${label}: ${score!.toFixed(1)}/10`}
        >
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{score!.toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

// Job card with inline sliding actions
function JobCard({
  job,
  index,
  isActionsOpen,
  onToggleActions,
  onCloseActions,
  onDelete,
  onMoveToFolder,
  compareMode,
  isComparable,
  isSelected,
  onToggleSelect,
  jobFolderId,
}: {
  job: ResearchJobWithVerdict
  index: number
  isActionsOpen: boolean
  onToggleActions: () => void
  onCloseActions: () => void
  onDelete: (id: string) => void
  onMoveToFolder: (jobId: string, folderId: string | null) => void
  compareMode: boolean
  isComparable: boolean
  isSelected: boolean
  onToggleSelect: () => void
  jobFolderId: string | null
}) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFolderSelector, setShowFolderSelector] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  const jobNextStep = getNextIncompleteStep(job.step_status)
  const isFullyCompleted = jobNextStep === null
  const isClickable = job.status !== 'failed'

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActionsOpen) {
        onCloseActions()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isActionsOpen, onCloseActions])

  // Action handlers
  const handleMoveClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowFolderSelector(true)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    onDelete(job.id)
    setShowDeleteConfirm(false)
    onCloseActions()
  }

  const handleFolderSelect = (newFolderId: string | null) => {
    onMoveToFolder(job.id, newFolderId)
    setShowFolderSelector(false)
    onCloseActions()
  }

  const handleCreateFolderSuccess = (createdFolder?: { id: string; name: string }) => {
    setShowCreateFolder(false)
    if (createdFolder) {
      onMoveToFolder(job.id, createdFolder.id)
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('folders-updated'))
    }, 200)
    onCloseActions()
  }

  const handleRowClick = (e: React.MouseEvent) => {
    if (compareMode && isComparable) {
      e.preventDefault()
      onToggleSelect()
    }
  }

  const href = isClickable ? `/research/${job.id}` : '#'

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={!compareMode && !isActionsOpen ? { y: -2 } : undefined}
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card shadow-sm',
          'transition-all duration-300 ease-out',
          isSelected
            ? 'bg-primary/5 border-primary/50 shadow-md'
            : 'hover:shadow-md hover:border-border/80',
          compareMode && !isComparable && 'opacity-50'
        )}
      >
        {/* Main card content */}
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4">
          {/* Checkbox (only in compare mode) */}
          {compareMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              disabled={!isComparable || (!isSelected && false)}
              className="shrink-0 mt-1 sm:mt-0"
            />
          )}

          {/* Verdict dot for completed jobs */}
          {job.verdictData && (
            <div className="shrink-0">
              <VerdictDot verdict={job.verdictData.verdict} score={job.verdictData.overallScore} />
            </div>
          )}

          {/* Research type icon - embossed style */}
          <ResearchTypeIcon type={getResearchType(job.coverage_data)} />

          {/* Job content - clickable */}
          <Link
            href={compareMode ? '#' : href}
            onClick={handleRowClick}
            className={`flex-1 flex flex-col sm:flex-row sm:items-center justify-between min-w-0 gap-2 sm:gap-4 ${
              !isClickable && !compareMode ? 'cursor-default' : ''
            } ${compareMode ? 'cursor-pointer' : ''}`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base line-clamp-2 sm:truncate">
                {getDisplayTitle(job)}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 sm:mt-1">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(job.created_at)}
                </p>
                {job.verdictData && (
                  <MiniMetrics
                    painScore={job.verdictData.painScore}
                    marketScore={job.verdictData.marketScore}
                    timingScore={job.verdictData.timingScore}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Type badge - subtle, monochromatic */}
              <span className="hidden sm:inline text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                {getResearchType(job.coverage_data) === 'app' ? 'App' : 'Hypothesis'}
              </span>
              {isFullyCompleted ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 border-0 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Completed</span>
                  <span className="sm:hidden">Done</span>
                </Badge>
              ) : job.status === 'failed' ? (
                getStatusBadge(job.status)
              ) : jobNextStep ? (
                <Badge variant="outline" className="text-muted-foreground text-xs">
                  {jobNextStep.icon}
                  <span className="ml-1 hidden sm:inline">{jobNextStep.label}</span>
                </Badge>
              ) : (
                getStatusBadge(job.status)
              )}
              {isClickable && !compareMode && !isActionsOpen && (
                <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
              )}
            </div>
          </Link>

          {/* Kebab menu button (only when not in compare mode) */}
          {!compareMode && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleActions()
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors shrink-0",
                isActionsOpen
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sliding action buttons overlay */}
        <AnimatePresence>
          {isActionsOpen && !compareMode && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute inset-y-0 right-0 w-1/2 sm:w-1/4 flex items-stretch bg-background border-l shadow-lg"
            >
              {/* Action buttons - iOS style with icons and labels */}
              <button
                onClick={handleMoveClick}
                className="flex-1 flex flex-col items-center justify-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
              >
                <FolderInput className="h-4 w-4" />
                <span className="text-[10px] font-medium">Move</span>
              </button>
              <button
                onClick={handleDeleteClick}
                className="flex-1 flex flex-col items-center justify-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-[10px] font-medium">Delete</span>
              </button>
              <button
                onClick={onCloseActions}
                className="w-10 flex flex-col items-center justify-center gap-1 bg-muted/30 hover:bg-muted/50 transition-colors border-l"
              >
                <X className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Close</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Folder selector modal */}
      {showFolderSelector && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={() => setShowFolderSelector(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl border p-4 z-[201] w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-3">Move to Folder</h3>
            <FolderSelector
              currentFolderId={jobFolderId}
              onSelect={handleFolderSelect}
              onClose={() => setShowFolderSelector(false)}
            />
            <hr className="my-2 border-border" />
            <button
              onClick={() => {
                setShowFolderSelector(false)
                setShowCreateFolder(true)
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-muted w-full text-left rounded-md"
            >
              <FolderPlus className="h-4 w-4" />
              Create New Folder
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl border p-6 z-[201] w-full max-w-sm">
            <h3 className="font-semibold text-lg mb-2">Delete Research?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. This will permanently delete this research and all its results.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Create folder dialog */}
      <FolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        folder={null}
        onSuccess={handleCreateFolderSuccess}
      />
    </>
  )
}

interface ResearchJobListProps {
  jobs: ResearchJobWithVerdict[]
}

// Filter type for the list
type FilterType = 'all' | 'hypothesis' | 'app'

export function ResearchJobList({ jobs }: ResearchJobListProps) {
  const router = useRouter()
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [compareMode, setCompareMode] = useState(false)
  const [deletedJobs, setDeletedJobs] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [jobFolders, setJobFolders] = useState<Map<string, string | null>>(new Map())
  const [openActionsJobId, setOpenActionsJobId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')

  // Handle moving job to folder
  const handleMoveToFolder = async (jobId: string, folderId: string | null) => {
    setJobFolders(prev => new Map(prev).set(jobId, folderId))

    const success = await updateJobFolder(jobId, folderId)
    if (!success) {
      setJobFolders(prev => {
        const next = new Map(prev)
        next.delete(jobId)
        return next
      })
    } else {
      window.dispatchEvent(new Event('folders-updated'))
      router.refresh()
    }
  }

  // Handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    try {
      setDeletedJobs(prev => new Set(prev).add(jobId))

      const response = await fetch(`/api/research/jobs?id=${jobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setDeletedJobs(prev => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
        console.error('Failed to delete job')
      }
    } catch (error) {
      setDeletedJobs(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      console.error('Error deleting job:', error)
    }
  }

  // Filter out deleted jobs
  const nonDeletedJobs = jobs.filter(job => !deletedJobs.has(job.id))

  // Count jobs by type
  const hypothesisCount = nonDeletedJobs.filter(job => getResearchType(job.coverage_data) === 'hypothesis').length
  const appCount = nonDeletedJobs.filter(job => getResearchType(job.coverage_data) === 'app').length

  // Filter by type
  const allVisibleJobs = filterType === 'all'
    ? nonDeletedJobs
    : nonDeletedJobs.filter(job => getResearchType(job.coverage_data) === filterType)

  // Show first 10 by default, all when expanded
  const visibleJobs = showAll ? allVisibleJobs : allVisibleJobs.slice(0, 10)
  const hasMore = allVisibleJobs.length > 10

  // Only completed jobs can be compared
  const comparableJobs = jobs.filter(job => job.status === 'completed')
  const canCompare = comparableJobs.length >= 2

  const toggleJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
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

  // Check if truly empty (no jobs at all) vs filtered empty
  const hasAnyJobs = nonDeletedJobs.length > 0

  if (!hasAnyJobs) {
    return (
      <div className="text-center py-6 sm:py-8">
        <p className="text-muted-foreground mb-4 text-sm sm:text-base">
          No research projects yet. Start your first one above!
        </p>
        <Link href="/research">
          <Button variant="outline" size="sm" className="text-sm">
            Start Your First Research
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Filter pills - only show if there are both types */}
      {hypothesisCount > 0 && appCount > 0 && (
        <div className="flex items-center gap-2 pb-2">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
              filterType === 'all'
                ? "bg-foreground text-background"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All ({nonDeletedJobs.length})
          </button>
          <button
            onClick={() => setFilterType('hypothesis')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
              filterType === 'hypothesis'
                ? "bg-foreground text-background"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Lightbulb className="h-3 w-3" />
            Hypothesis ({hypothesisCount})
          </button>
          <button
            onClick={() => setFilterType('app')}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
              filterType === 'app'
                ? "bg-foreground text-background"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Smartphone className="h-3 w-3" />
            App ({appCount})
          </button>
        </div>
      )}

      {/* Empty state when filtered */}
      {visibleJobs.length === 0 && filterType !== 'all' && (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-sm">
            No {filterType === 'hypothesis' ? 'hypothesis validation' : 'app analysis'} research found.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterType('all')}
            className="mt-2 text-xs"
          >
            Show all research
          </Button>
        </div>
      )}

      {/* Compare Mode Controls */}
      {canCompare && (
        <div className="flex items-center justify-between pb-2">
          {compareMode ? (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-xs sm:text-sm text-muted-foreground">
                {selectedJobs.size} of 4 selected
              </span>
              <Button
                size="sm"
                onClick={handleCompare}
                disabled={selectedJobs.size < 2}
                className="text-xs sm:text-sm"
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Compare ({selectedJobs.size})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={exitCompareMode}
                className="text-xs sm:text-sm"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCompareMode(true)}
              className="text-xs sm:text-sm"
            >
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Compare Hypotheses
            </Button>
          )}
        </div>
      )}

      {/* Job List */}
      {visibleJobs.map((job, index) => {
        const isComparable = job.status === 'completed'
        const isSelected = selectedJobs.has(job.id)

        return (
          <JobCard
            key={job.id}
            job={job}
            index={index}
            isActionsOpen={openActionsJobId === job.id}
            onToggleActions={() => setOpenActionsJobId(openActionsJobId === job.id ? null : job.id)}
            onCloseActions={() => setOpenActionsJobId(null)}
            onDelete={handleDeleteJob}
            onMoveToFolder={handleMoveToFolder}
            compareMode={compareMode}
            isComparable={isComparable}
            isSelected={isSelected}
            onToggleSelect={() => toggleJob(job.id)}
            jobFolderId={jobFolders.get(job.id) ?? job.folder_id}
          />
        )
      })}

      {/* Show More / Show Less Button */}
      {hasMore && (
        <div className="text-center pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs sm:text-sm"
          >
            {showAll ? (
              <>
                <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Show More ({allVisibleJobs.length - 10} more)
              </>
            )}
          </Button>
        </div>
      )}

      {/* Compare hint when not enough jobs */}
      {!canCompare && allVisibleJobs.length > 0 && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Complete at least 2 research projects to compare them
        </p>
      )}
    </div>
  )
}
