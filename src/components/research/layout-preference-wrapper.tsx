'use client'

import { ReactNode, Suspense } from 'react'
import { LayoutPreferenceProvider } from '@/hooks/use-layout-preference'

interface LayoutPreferenceWrapperProps {
  children: ReactNode
}

export function LayoutPreferenceWrapper({ children }: LayoutPreferenceWrapperProps) {
  return (
    <Suspense fallback={null}>
      <LayoutPreferenceProvider>
        {children}
      </LayoutPreferenceProvider>
    </Suspense>
  )
}
