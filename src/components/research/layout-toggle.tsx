'use client'

import { LayoutGrid, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLayoutPreference } from '@/hooks/use-layout-preference'
import { cn } from '@/lib/utils'

interface LayoutToggleProps {
  className?: string
}

export function LayoutToggle({ className }: LayoutToggleProps) {
  const { layout, setLayout, isLoaded } = useLayoutPreference()

  // Don't render until loaded to avoid hydration mismatch
  if (!isLoaded) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground hidden sm:inline">View:</span>
      <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLayout('tabbed')}
          className={cn(
            'h-7 px-2.5 rounded-md transition-colors',
            layout === 'tabbed'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
          <span className="text-xs">Tabs</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLayout('scroll')}
          className={cn(
            'h-7 px-2.5 rounded-md transition-colors',
            layout === 'scroll'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <ScrollText className="h-3.5 w-3.5 mr-1.5" />
          <span className="text-xs">Scroll</span>
          <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-600">
            Beta
          </Badge>
        </Button>
      </div>
    </div>
  )
}
