'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  HeartPulse,
  Zap,
} from 'lucide-react'
import type { APIHealthData } from './types'

interface APIHealthTabProps {
  apiHealth: APIHealthData | null
  loading: boolean
  error: string | null
  cleanupRunning: boolean
  onFetch: () => void
  onCleanup: () => void
}

export function APIHealthTab({
  apiHealth,
  loading,
  error,
  cleanupRunning,
  onFetch,
  onCleanup,
}: APIHealthTabProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-400" />
          <p className="text-gray-500">Loading API health data...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-700 font-medium mb-2">Failed to Load API Health</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <Button onClick={onFetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!apiHealth) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <HeartPulse className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">Click to check API health status</p>
          <Button onClick={onFetch}>
            <HeartPulse className="h-4 w-4 mr-2" />
            Check API Health
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={apiHealth.pendingRefunds > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className={`h-5 w-5 ${apiHealth.pendingRefunds > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-500">Pending Refunds</span>
            </div>
            <div className={`text-2xl font-bold ${apiHealth.pendingRefunds > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {apiHealth.pendingRefunds}
            </div>
            <p className="text-xs text-gray-500 mt-1">Failed jobs with known cause</p>
          </CardContent>
        </Card>
        <Card className={apiHealth.stuckProcessing > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className={`h-5 w-5 ${apiHealth.stuckProcessing > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-500">Stuck Processing</span>
            </div>
            <div className={`text-2xl font-bold ${apiHealth.stuckProcessing > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {apiHealth.stuckProcessing}
            </div>
            <p className="text-xs text-gray-500 mt-1">&gt;{apiHealth.staleThresholdMinutes} min in processing</p>
          </CardContent>
        </Card>
        <Card className={apiHealth.failedWithoutSource > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className={`h-5 w-5 ${apiHealth.failedWithoutSource > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-500">Unknown Failures</span>
            </div>
            <div className={`text-2xl font-bold ${apiHealth.failedWithoutSource > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {apiHealth.failedWithoutSource}
            </div>
            <p className="text-xs text-gray-500 mt-1">Failed without error source</p>
          </CardContent>
        </Card>
        <Card className={Object.keys(apiHealth.errorSourceBreakdown).length === 0 ? 'border-green-200 bg-green-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className={`h-5 w-5 ${Object.keys(apiHealth.errorSourceBreakdown).length === 0 ? 'text-green-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-gray-500">System Health</span>
            </div>
            <div className={`text-2xl font-bold ${Object.keys(apiHealth.errorSourceBreakdown).length === 0 ? 'text-green-600' : 'text-gray-600'}`}>
              {Object.keys(apiHealth.errorSourceBreakdown).length === 0 ? 'Healthy' : 'Issues'}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Object.values(apiHealth.errorSourceBreakdown).reduce((a, b) => a + b, 0)} errors (24h)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Error Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Error Source Breakdown (Last 24 Hours)
          </CardTitle>
          <CardDescription>
            Which APIs or components caused failures
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(apiHealth.errorSourceBreakdown).length === 0 ? (
            <div className="text-center py-8">
              <HeartPulse className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-green-600">No API Failures</p>
              <p className="text-gray-500 mt-1">All systems operating normally in the last 24 hours</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(apiHealth.errorSourceBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        source === 'anthropic' ? 'default' :
                        source === 'arctic_shift' ? 'secondary' :
                        source === 'database' ? 'destructive' :
                        'outline'
                      }>
                        {source}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {source === 'anthropic' && 'Claude API errors'}
                        {source === 'arctic_shift' && 'Reddit data source errors'}
                        {source === 'database' && 'Database/Supabase errors'}
                        {source === 'timeout' && 'Request timeouts'}
                        {source === 'unknown' && 'Untracked error sources'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${count >= 5 ? 'text-red-600' : count >= 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                        {count}
                      </span>
                      <span className="text-sm text-gray-400">failures</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manage failed and stuck jobs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Run Auto-Cleanup</h4>
              <p className="text-sm text-gray-500">
                Auto-refund {apiHealth.pendingRefunds} failed jobs with known error sources
              </p>
            </div>
            <Button
              onClick={onCleanup}
              disabled={cleanupRunning || apiHealth.pendingRefunds === 0}
            >
              {cleanupRunning ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Run Cleanup
                </>
              )}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onFetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Stats
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
