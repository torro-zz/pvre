'use client'

import { LayoutGrid, ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayoutPreference } from '@/hooks/use-layout-preference'
import { cn } from '@/lib/utils'

interface LayoutToggleProps {
  className?: string
}

export function LayoutToggle({ className }: LayoutToggleProps) {
  // Temporarily disabled - tabs only view (Phase 1 UI redesign)
  return null
}
