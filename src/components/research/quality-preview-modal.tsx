'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Lightbulb, TrendingDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface BroadeningSuggestion {
  phrase: string
  suggestion: string
  broaderHypothesis?: string
}

export interface QualityPreviewData {
  predictedRelevance: number
  predictedConfidence: 'very_low' | 'low' | 'medium' | 'high'
  qualityWarning: 'none' | 'caution' | 'strong_warning'
  sampleSize: number  // Actual sample size used for prediction
  removedPostRate?: number  // Rate of removed/unavailable posts (0-100)
  sampleRelevant: Array<{
    title: string
    body_preview: string
    subreddit: string
  }>
  sampleFiltered: Array<{
    title: string
    body_preview: string
    subreddit: string
    filterReason: string
  }>
  filteredTopics: Array<{ topic: string; count: number }>
  suggestion?: string
  broadenings?: BroadeningSuggestion[]
}

interface QualityPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qualityData: QualityPreviewData
  onProceed: () => void
  onRefine: () => void
}

export function QualityPreviewModal({
  open,
  onOpenChange,
  qualityData,
  onProceed,
  onRefine,
}: QualityPreviewModalProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [showFiltered, setShowFiltered] = useState(false)

  const {
    predictedRelevance,
    predictedConfidence,
    qualityWarning,
    sampleSize,
    removedPostRate,
    sampleRelevant,
    sampleFiltered,
    filteredTopics,
    suggestion,
    broadenings,
  } = qualityData

  const isStrongWarning = qualityWarning === 'strong_warning'
  const isCaution = qualityWarning === 'caution'
  // Only require acknowledgment for strong warnings (< 8% relevance)
  // Caution (8-20%) is actually normal and doesn't need friction
  const needsAcknowledgment = isStrongWarning

  const handleProceed = () => {
    if (needsAcknowledgment && !acknowledged) return
    onProceed()
    onOpenChange(false)
  }

  const handleRefine = () => {
    onRefine()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isStrongWarning && <AlertTriangle className="w-5 h-5 text-red-500" />}
            {isCaution && <AlertTriangle className="w-5 h-5 text-amber-500" />}
            {!needsAcknowledgment && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            Expected Research Quality
          </DialogTitle>
          <DialogDescription>
            Based on analyzing {sampleSize} posts from your selected communities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quality Score */}
          <div className={cn(
            "p-4 rounded-lg border",
            isStrongWarning && "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
            isCaution && "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
            !needsAcknowledgment && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Expected Relevance</span>
              <span className={cn(
                "text-2xl font-bold",
                isStrongWarning && "text-red-600 dark:text-red-400",
                isCaution && "text-amber-600 dark:text-amber-400",
                !needsAcknowledgment && "text-emerald-600 dark:text-emerald-400"
              )}>
                {predictedRelevance}%
              </span>
            </div>
            <p className={cn(
              "text-sm",
              isStrongWarning && "text-red-700 dark:text-red-300",
              isCaution && "text-amber-700 dark:text-amber-300",
              !needsAcknowledgment && "text-emerald-700 dark:text-emerald-300"
            )}>
              {isStrongWarning && "Very few matching posts found. Consider refining your search."}
              {isCaution && "Moderate match rate. Research will focus on relevant discussions."}
              {!needsAcknowledgment && "Good relevance. Results should be useful."}
            </p>
          </div>

          {/* Removed Post Rate Warning */}
          {removedPostRate && removedPostRate >= 30 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">{removedPostRate}% of posts unavailable</span>
                <span className="text-amber-700 dark:text-amber-300 ml-1">
                  — many posts in these communities have been removed by moderators
                </span>
              </div>
            </div>
          )}

          {/* Sample Relevant Posts */}
          {sampleRelevant.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                Relevant Posts ({sampleRelevant.length} found)
              </div>
              <div className="space-y-2 pl-6">
                {sampleRelevant.map((post, i) => (
                  <div key={i} className="text-sm p-2 bg-muted/50 rounded border border-emerald-200/30">
                    <div className="font-medium text-foreground line-clamp-2">{post.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">r/{post.subreddit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtered Posts (collapsible) */}
          {sampleFiltered.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowFiltered(!showFiltered)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <XCircle className="w-4 h-4" />
                Filtered Out ({sampleFiltered.length} posts)
                {showFiltered ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </button>
              {showFiltered && (
                <div className="space-y-2 pl-6">
                  {sampleFiltered.map((post, i) => (
                    <div key={i} className="text-sm p-2 bg-muted/30 rounded border border-border/50 opacity-70">
                      <div className="text-foreground/70 line-clamp-1">{post.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        r/{post.subreddit} • {post.filterReason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* What topics were filtered */}
          {filteredTopics.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                Your audience talks more about:
              </div>
              <div className="flex flex-wrap gap-2">
                {filteredTopics.map((topic, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-background rounded border">
                    {topic.topic} ({topic.count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggestion */}
          {suggestion && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">{suggestion}</p>
            </div>
          )}

          {/* Broadening suggestions */}
          {broadenings && broadenings.length > 0 && (
            <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Search className="w-4 h-4" />
                Try broadening your search:
              </div>
              <div className="space-y-2 pl-6">
                {broadenings.map((b, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-amber-700 dark:text-amber-300">
                      Remove &ldquo;<span className="font-medium">{b.phrase}</span>&rdquo;
                    </span>
                    <span className="text-amber-600/80 dark:text-amber-400/80 ml-1">
                      — {b.suggestion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acknowledgment checkbox for warnings */}
          {needsAcknowledgment && (
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
              <Checkbox
                id="acknowledge"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="acknowledge" className="text-sm text-muted-foreground cursor-pointer">
                I understand that very few matching posts were found and results may be limited
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleRefine} className="w-full sm:w-auto">
            <Search className="w-4 h-4 mr-2" />
            Refine Hypothesis
          </Button>
          <Button
            onClick={handleProceed}
            disabled={needsAcknowledgment && !acknowledged}
            className="w-full sm:w-auto"
          >
            {needsAcknowledgment ? 'Proceed Anyway' : 'Start Research'}
            <span className="ml-2 text-xs opacity-70">1 credit</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Helper function to check if quality preview should trigger a warning modal
 */
export function shouldShowQualityWarning(qualityPreview: QualityPreviewData | undefined): boolean {
  if (!qualityPreview) return false
  return qualityPreview.qualityWarning !== 'none'
}
