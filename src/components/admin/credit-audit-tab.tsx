'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  RefreshCw,
  AlertCircle,
  Shield,
} from 'lucide-react'
import type { CreditAuditData } from './types'

interface CreditAuditTabProps {
  creditAudit: CreditAuditData | null
  loading: boolean
  onFetch: () => void
}

export function CreditAuditTab({ creditAudit, loading, onFetch }: CreditAuditTabProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-400" />
          <p className="text-gray-500">Loading credit audit data...</p>
        </CardContent>
      </Card>
    )
  }

  if (!creditAudit) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">Click to load credit audit data</p>
          <Button onClick={onFetch}>
            <Shield className="h-4 w-4 mr-2" />
            Run Credit Audit
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-500">Orphaned Jobs</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {creditAudit.summary.totalOrphaned}
            </div>
            <p className="text-xs text-gray-500 mt-1">Completed but no results</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-500">Stale Jobs</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {creditAudit.summary.totalStale}
            </div>
            <p className="text-xs text-gray-500 mt-1">Stuck pending/processing &gt;1hr</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-500">Credits at Risk</span>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {creditAudit.summary.creditsAtRisk}
            </div>
            <p className="text-xs text-gray-500 mt-1">Potential credit loss</p>
          </CardContent>
        </Card>
      </div>

      {/* Orphaned Jobs Table */}
      {creditAudit.orphanedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Orphaned Jobs (Completed without Results)
            </CardTitle>
            <CardDescription>
              Jobs marked as completed but have no results saved - likely credit was charged without delivering value
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditAudit.orphanedJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-red-200 bg-red-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.user_email}</span>
                      <Badge variant="destructive" className="text-xs">
                        {job.issue}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{job.hypothesis}</p>
                    <p className="text-xs text-gray-400">
                      Created: {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stale Jobs Table */}
      {creditAudit.staleJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-yellow-500" />
              Stale Jobs (Stuck in Queue)
            </CardTitle>
            <CardDescription>
              Jobs stuck in pending/processing for more than 1 hour - may indicate system issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditAudit.staleJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-start justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.user_email}</span>
                      <Badge variant="outline" className="text-xs bg-yellow-100">
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{job.hypothesis}</p>
                    <p className="text-xs text-gray-400">
                      Created: {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Clear Message */}
      {creditAudit.orphanedJobs.length === 0 && creditAudit.staleJobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium text-green-600">All Clear!</p>
            <p className="text-gray-500 mt-2">No orphaned or stale jobs detected</p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onFetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Audit
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Last updated: {new Date(creditAudit.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
