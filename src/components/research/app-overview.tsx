'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Star, Download, DollarSign, Calendar, ExternalLink, Smartphone } from 'lucide-react'
import type { AppDetails } from '@/lib/data-sources/types'

interface AppOverviewProps {
  appData: AppDetails
}

// Format lastUpdated - handles timestamps (ms or s) and date strings
function formatLastUpdated(value: string | undefined): string | null {
  if (!value) return null

  // Check if it's a numeric timestamp
  const numValue = Number(value)
  if (!isNaN(numValue) && numValue > 0) {
    // If it's in milliseconds (13+ digits), convert to seconds
    const timestamp = numValue > 9999999999 ? numValue : numValue * 1000
    const date = new Date(timestamp)
    // Validate it's a reasonable date (between 2000 and 2100)
    if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  // If it's already a formatted string, return as-is
  return value
}

export function AppOverview({ appData }: AppOverviewProps) {
  const storeIcon = appData.store === 'google_play' ? '🤖' : '🍎'
  const storeName = appData.store === 'google_play' ? 'Google Play' : 'App Store'

  return (
    <div className="space-y-6">
      {/* App Header Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 p-6">
          <div className="flex gap-4">
            {/* App Icon */}
            {appData.iconUrl && (
              <img
                src={appData.iconUrl}
                alt={appData.name}
                className="w-20 h-20 rounded-2xl shadow-lg flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold truncate">{appData.name}</h2>
                <Badge variant="outline" className="text-xs">
                  {storeIcon} {storeName}
                </Badge>
              </div>
              <p className="text-muted-foreground">{appData.developer}</p>

              {/* Quick Stats */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">{appData.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground text-sm">
                    ({appData.reviewCount.toLocaleString()} reviews)
                  </span>
                </div>

                {appData.installs && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    {appData.installs}
                  </div>
                )}

                <Badge className={
                  appData.price === 'Free'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                }>
                  <DollarSign className="h-3 w-3 mr-1" />
                  {appData.price}
                  {appData.hasIAP && ' + IAP'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="pt-6">
          {/* Category & Last Updated */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 rounded-lg bg-muted">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Category</p>
                <p className="font-medium">{appData.category}</p>
              </div>
            </div>

            {formatLastUpdated(appData.lastUpdated) && (
              <div className="flex items-center gap-2 text-sm">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Last Updated</p>
                  <p className="font-medium">{formatLastUpdated(appData.lastUpdated)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Description
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
              {appData.description}
            </p>
          </div>

          {/* View in Store Link */}
          {appData.url && (
            <a
              href={appData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline"
            >
              View in {storeName}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
      </Card>

      {/* Research Context */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-2">What This Analysis Covers</h3>
          <p className="text-sm text-muted-foreground mb-4">
            We're analyzing {appData.name} to understand the market opportunity around it:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>What problems the app solves and how well it addresses them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>What users love and hate about the app (from reviews)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>How people discuss this problem space on Reddit/forums</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">✓</span>
              <span>Unmet needs and opportunities for a competing product</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
