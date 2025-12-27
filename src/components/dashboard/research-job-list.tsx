'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, ArrowRight, CheckCircle2, Loader2, XCircle, TrendingUp, Target, Hourglass, Users, BarChart3, Copy, Trash2, ChevronDown, ChevronUp, FolderInput, FolderPlus } from 'lucide-react'
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

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  step_status: StepStatusMap | null
  folder_id: string | null
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

  // All steps completed
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

// Swipe action button widths
const ACTION_BUTTON_WIDTH = 64 // Each action button width in pixels
const TOTAL_ACTIONS_WIDTH = ACTION_BUTTON_WIDTH * 3 // 3 buttons: Duplicate, Move, Delete
const SWIPE_THRESHOLD = 50 // Minimum swipe distance to trigger reveal

// Swipeable job card with iOS-style action reveal
function SwipeableJobCard({
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
  children,
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
  children: React.ReactNode
}) {
  const router = useRouter()
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFolderSelector, setShowFolderSelector] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const startTranslateX = useRef(0)
  const isHorizontalSwipe = useRef<boolean | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // Update translateX when actions state changes externally
  useEffect(() => {
    if (!isActionsOpen && !isDragging) {
      setTranslateX(0)
    } else if (isActionsOpen && !isDragging) {
      setTranslateX(-TOTAL_ACTIONS_WIDTH)
    }
  }, [isActionsOpen, isDragging])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActionsOpen) {
        onCloseActions()
        setShowFolderSelector(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isActionsOpen, onCloseActions])

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (compareMode) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    startTranslateX.current = translateX
    isHorizontalSwipe.current = null
    setIsDragging(true)
  }, [compareMode, translateX])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (compareMode || !isDragging) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const diffX = touchStartX.current - currentX
    const diffY = touchStartY.current - currentY

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY)
      }
    }

    // Only handle horizontal swipes
    if (isHorizontalSwipe.current) {
      e.preventDefault()
      let newTranslate = startTranslateX.current - diffX

      // Clamp the translation
      newTranslate = Math.max(-TOTAL_ACTIONS_WIDTH, Math.min(0, newTranslate))

      setTranslateX(newTranslate)
    }
  }, [compareMode, isDragging])

  const handleTouchEnd = useCallback(() => {
    if (compareMode || !isDragging) return
    setIsDragging(false)
    isHorizontalSwipe.current = null

    // Snap to open or closed based on position and velocity
    const shouldOpen = translateX < -SWIPE_THRESHOLD

    if (shouldOpen && !isActionsOpen) {
      onToggleActions()
    } else if (!shouldOpen && isActionsOpen) {
      onCloseActions()
    } else {
      // Snap back to current state
      setTranslateX(isActionsOpen ? -TOTAL_ACTIONS_WIDTH : 0)
    }
  }, [compareMode, isDragging, translateX, isActionsOpen, onToggleActions, onCloseActions])

  // Mouse handlers for desktop drag support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (compareMode) return
    // Only start drag on the card content, not on buttons/links
    if ((e.target as HTMLElement).closest('a, button')) return

    touchStartX.current = e.clientX
    touchStartY.current = e.clientY
    startTranslateX.current = translateX
    isHorizontalSwipe.current = null
    setIsDragging(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diffX = touchStartX.current - moveEvent.clientX
      const diffY = touchStartY.current - moveEvent.clientY

      if (isHorizontalSwipe.current === null) {
        if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
          isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY)
        }
      }

      if (isHorizontalSwipe.current) {
        let newTranslate = startTranslateX.current - diffX
        newTranslate = Math.max(-TOTAL_ACTIONS_WIDTH, Math.min(0, newTranslate))
        setTranslateX(newTranslate)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      isHorizontalSwipe.current = null

      const shouldOpen = translateX < -SWIPE_THRESHOLD

      if (shouldOpen && !isActionsOpen) {
        onToggleActions()
      } else if (!shouldOpen && isActionsOpen) {
        onCloseActions()
      } else {
        setTranslateX(isActionsOpen ? -TOTAL_ACTIONS_WIDTH : 0)
      }

      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [compareMode, translateX, isActionsOpen, onToggleActions, onCloseActions])

  // Action handlers
  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/research?hypothesis=${encodeURIComponent(job.hypothesis)}`)
    onCloseActions()
  }

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

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card shadow-sm',
          'transition-shadow duration-300 ease-out',
          isSelected
            ? 'bg-primary/5 border-primary/50 shadow-md'
            : 'hover:shadow-md hover:border-border/80',
          compareMode && !isComparable && 'opacity-50'
        )}
      >
        {/* Action buttons background layer */}
        <div className="absolute inset-y-0 right-0 flex">
          <button
            onClick={handleDuplicate}
            className="w-16 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title="Duplicate"
          >
            <Copy className="h-5 w-5" />
            <span className="text-[10px] font-medium">Duplicate</span>
          </button>
          <button
            onClick={handleMoveClick}
            className="w-16 flex flex-col items-center justify-center gap-1 bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            title="Move to Folder"
          >
            <FolderInput className="h-5 w-5" />
            <span className="text-[10px] font-medium">Move</span>
          </button>
          <button
            onClick={handleDeleteClick}
            className="w-16 flex flex-col items-center justify-center gap-1 bg-red-500 text-white hover:bg-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[10px] font-medium">Delete</span>
          </button>
        </div>

        {/* Card content layer that slides */}
        <div
          className={cn(
            'relative flex items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-card',
            isDragging ? '' : 'transition-transform duration-300 ease-out',
            !compareMode && 'cursor-grab active:cursor-grabbing'
          )}
          style={{ transform: `translateX(${translateX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {/* Checkbox (only in compare mode) */}
          {compareMode && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              disabled={!isComparable || (!isSelected && false)} // removed size limit check for simplicity
              className="shrink-0 mt-1 sm:mt-0"
            />
          )}

          {children}
        </div>
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

export function ResearchJobList({ jobs }: ResearchJobListProps) {
  const router = useRouter()
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set())
  const [compareMode, setCompareMode] = useState(false)
  const [deletedJobs, setDeletedJobs] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [jobFolders, setJobFolders] = useState<Map<string, string | null>>(new Map())
  // Track which job has swipe actions open (only one at a time)
  const [openActionsJobId, setOpenActionsJobId] = useState<string | null>(null)

  // Handle moving job to folder
  const handleMoveToFolder = async (jobId: string, folderId: string | null) => {
    // Optimistic update
    setJobFolders(prev => new Map(prev).set(jobId, folderId))

    const success = await updateJobFolder(jobId, folderId)
    if (!success) {
      // Rollback on error
      setJobFolders(prev => {
        const next = new Map(prev)
        next.delete(jobId)
        return next
      })
    } else {
      // Refresh folder counts in sidebar
      window.dispatchEvent(new Event('folders-updated'))
      router.refresh()
    }
  }

  // Handle job deletion
  const handleDeleteJob = async (jobId: string) => {
    try {
      // Optimistically remove from UI
      setDeletedJobs(prev => new Set(prev).add(jobId))

      // Make API call to delete
      const response = await fetch(`/api/research/jobs?id=${jobId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        // Rollback on error
        setDeletedJobs(prev => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
        console.error('Failed to delete job')
      }
    } catch (error) {
      // Rollback on error
      setDeletedJobs(prev => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      console.error('Error deleting job:', error)
    }
  }

  // Filter out deleted jobs
  const allVisibleJobs = jobs.filter(job => !deletedJobs.has(job.id))

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

  if (visibleJobs.length === 0) {
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
          <SwipeableJobCard
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
          >
            {/* Verdict dot for completed jobs */}
            {job.verdictData && (
              <div className="shrink-0">
                <VerdictDot verdict={job.verdictData.verdict} score={job.verdictData.overallScore} />
              </div>
            )}

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
                  {truncateText(job.hypothesis, 60)}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 sm:mt-1">
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(job.created_at)}
                  </p>
                  {/* Mini metrics for completed jobs */}
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
                {isClickable && !compareMode && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                )}
              </div>
            </Link>
          </SwipeableJobCard>
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
