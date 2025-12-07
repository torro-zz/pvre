'use client'

import { useState, useEffect } from 'react'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useResearchTabs } from './research-tabs-context'

interface CompetitorPromptModalProps {
  jobId: string
  hypothesis: string
}

export function CompetitorPromptModal({ jobId, hypothesis }: CompetitorPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { setActiveTab } = useResearchTabs()
  const storageKey = `competitor-prompt-dismissed-${jobId}`

  useEffect(() => {
    // Check if user has already dismissed this prompt
    const dismissed = localStorage.getItem(storageKey)
    if (!dismissed) {
      // Small delay to let page load first
      const timer = setTimeout(() => setIsOpen(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [storageKey])

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true')
    setIsOpen(false)
  }

  const handleRunCompetitors = () => {
    handleDismiss()
    setActiveTab('competitors')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Complete Your Analysis</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Your verdict is based on <span className="font-semibold">3 of 4 dimensions</span>.
            Run Competitor Intelligence to get the full picture of your market opportunity.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Pain Score (Community Voice)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Market Size (included)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Timing Analysis (included)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm font-medium">Competition Score (missing)</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDismiss}>
            Skip for now
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleRunCompetitors}
          >
            <Shield className="h-4 w-4 mr-2" />
            Run Competitor Analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CompetitorPromptBannerProps {
  jobId: string
  hypothesis: string
}

export function CompetitorPromptBanner({ jobId, hypothesis }: CompetitorPromptBannerProps) {
  const { setActiveTab } = useResearchTabs()

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-amber-600" />
        <div>
          <p className="font-medium text-amber-900">Partial Assessment (3/4 dimensions)</p>
          <p className="text-sm text-amber-700">
            Run Competitor Intelligence for a complete viability verdict
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 hover:bg-amber-100"
        onClick={() => setActiveTab('competitors')}
      >
        <Shield className="h-4 w-4 mr-2" />
        Add Competitors
      </Button>
    </div>
  )
}
