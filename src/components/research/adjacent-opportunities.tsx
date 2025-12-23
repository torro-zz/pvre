'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Lightbulb,
  TrendingUp,
  ArrowRight,
  Quote,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdjacentOpportunityData } from '@/lib/utils/coverage-helpers'

interface AdjacentOpportunitiesSectionProps {
  opportunities: AdjacentOpportunityData[]
  originalHypothesis?: string
  className?: string
}

// Generate a pivot angle suggestion based on theme and original hypothesis
export function generatePivotAngle(
  themeName: string,
  themeDescription: string,
  originalHypothesis?: string
): string {
  // Simple heuristic suggestions based on common patterns
  const lowerName = themeName.toLowerCase()

  if (lowerName.includes('client') || lowerName.includes('customer')) {
    return 'Solving client quality issues may prevent downstream payment and project problems'
  }
  if (lowerName.includes('time') || lowerName.includes('productivity')) {
    return 'Time management tools often address root causes of business stress'
  }
  if (lowerName.includes('pricing') || lowerName.includes('rate')) {
    return 'Pricing confidence could reduce payment negotiations and scope creep'
  }
  if (lowerName.includes('marketing') || lowerName.includes('visibility')) {
    return 'Lead generation directly impacts income stability concerns'
  }
  if (lowerName.includes('organization') || lowerName.includes('workflow')) {
    return 'Better organization often reveals the actual bottleneck in the workflow'
  }

  return `This adjacent problem may be related to or causing the issue you hypothesized`
}

function formatSourceList(sources: string[]): string {
  if (sources.length === 0) return ''
  if (sources.length === 1) return sources[0]
  return sources.slice(0, -1).join(', ') + ' & ' + sources[sources.length - 1]
}

function IntensityBadge({ intensity }: { intensity: 'low' | 'medium' | 'high' }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs',
        intensity === 'high' ? 'border-red-200 text-red-600 bg-red-50' :
        intensity === 'medium' ? 'border-yellow-200 text-yellow-600 bg-yellow-50' :
        'border-gray-200 text-gray-600 bg-gray-50'
      )}
    >
      {intensity.toUpperCase()}
    </Badge>
  )
}

export function AdjacentOpportunitiesSection({
  opportunities,
  originalHypothesis,
  className,
}: AdjacentOpportunitiesSectionProps) {
  if (opportunities.length === 0) {
    return null
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-primary" />
          Adjacent Opportunities
        </CardTitle>
        <CardDescription>
          Your specific hypothesis wasn't the most prominent topic, but we found strong signals around related problems. These could represent pivot opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {opportunities.map((opportunity, index) => (
          <div
            key={index}
            className="border rounded-lg p-4 space-y-3 bg-muted/20 hover:bg-muted/30 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>
                <h4 className="font-medium">{opportunity.name}</h4>
                <IntensityBadge intensity={opportunity.intensity} />
              </div>
              <Badge variant="secondary" className="shrink-0">
                {opportunity.signalCount} signals
              </Badge>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground">
              {opportunity.description}
            </p>

            {/* Quote if available */}
            {opportunity.representativeQuote && (
              <div className="flex gap-2 bg-background rounded-md p-3 border">
                <Quote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm italic">"{opportunity.representativeQuote}"</p>
                  {opportunity.quoteSource && (
                    <p className="text-xs text-muted-foreground mt-1">— {opportunity.quoteSource}</p>
                  )}
                </div>
              </div>
            )}

            {/* Pivot angle */}
            <div className="flex items-start gap-2 pt-2 border-t">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-medium text-amber-600 uppercase">Pivot Angle</span>
                <p className="text-sm text-muted-foreground">
                  {opportunity.pivotAngle || generatePivotAngle(opportunity.name, opportunity.description, originalHypothesis)}
                </p>
              </div>
            </div>

            {/* Sources */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sources: {formatSourceList(opportunity.sources)}</span>
            </div>
          </div>
        ))}

        {/* Call to action */}
        <div className="bg-primary/5 rounded-lg p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Consider these as pivot candidates</p>
            <p className="text-xs text-muted-foreground">
              Interview users about these adjacent problems - your original hypothesis may emerge naturally, or you'll discover where the real opportunity lies.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
        </div>
      </CardContent>
    </Card>
  )
}
