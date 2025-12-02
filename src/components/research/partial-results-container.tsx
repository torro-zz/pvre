'use client'

import { useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { StatusPoller, ResearchResult } from './status-poller'
import { ProcessingBanner } from './processing-banner'

interface PartialResultsContainerProps {
  jobId: string
  jobStatus: 'pending' | 'processing' | 'completed' | 'failed'
  initialResultsCount: number
  children: ReactNode
}

/**
 * Container component that enables partial results display during processing.
 *
 * When processing and results exist:
 * - Shows ProcessingBanner at top
 * - Continues polling for new results
 * - Triggers page refresh when new results arrive or job completes
 *
 * When processing and no results:
 * - Shows the visible StatusPoller spinner
 */
export function PartialResultsContainer({
  jobId,
  jobStatus,
  initialResultsCount,
  children,
}: PartialResultsContainerProps) {
  const router = useRouter()
  const [pollCount, setPollCount] = useState(0)
  const [lastResultsCount, setLastResultsCount] = useState(initialResultsCount)

  const handleResultsUpdate = useCallback((results: ResearchResult[]) => {
    setPollCount(p => p + 1)

    // If we got new results, refresh the page to re-render with updated data
    if (results.length > lastResultsCount) {
      setLastResultsCount(results.length)
      router.refresh()
    }
  }, [lastResultsCount, router])

  const isProcessing = jobStatus === 'processing' || jobStatus === 'pending'
  const hasResults = initialResultsCount > 0

  // Case 1: Processing with results - show banner + results + hidden poller
  if (isProcessing && hasResults) {
    return (
      <div className="space-y-6">
        <ProcessingBanner pollCount={pollCount} />
        {children}
        <StatusPoller
          jobId={jobId}
          initialStatus={jobStatus}
          onResultsUpdate={handleResultsUpdate}
          hidden={true}
        />
      </div>
    )
  }

  // Case 2: Processing without results - let parent show StatusPoller
  // (We return children which should include the StatusPoller)
  if (isProcessing) {
    return <>{children}</>
  }

  // Case 3: Not processing - just show children (completed/failed states)
  return <>{children}</>
}
