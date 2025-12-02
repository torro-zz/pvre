'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Clock } from 'lucide-react'

interface ProcessingBannerProps {
  pollCount: number
}

export function ProcessingBanner({ pollCount }: ProcessingBannerProps) {
  // Match StatusPoller's interval logic
  const pollInterval = pollCount < 20 ? 3 : 10

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Research in Progress
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Additional modules are being analyzed. Results appear as they complete.
            </p>
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Every {pollInterval}s
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
