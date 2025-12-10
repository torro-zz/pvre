'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  CreditCard,
  RefreshCw,
  FileText,
  BarChart3,
  TrendingUp,
  Activity,
  DollarSign,
  Cpu,
  TrendingDown,
  RotateCcw,
} from 'lucide-react'
import type { AnalyticsData } from './types'

interface AnalyticsTabProps {
  analytics: AnalyticsData | null
  loading: boolean
  onFetch: () => void
  onResetApiCosts: () => void
  onClearApiCostReset?: () => void
  apiCostResetAt: string | null
}

export function AnalyticsTab({ analytics, loading, onFetch, onResetApiCosts, onClearApiCostReset, apiCostResetAt }: AnalyticsTabProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p>Loading analytics...</p>
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 mb-4">Click to load analytics data</p>
          <Button onClick={onFetch}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Load Analytics
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Users className="h-4 w-4" />
              Total Users
            </div>
            <div className="text-2xl font-bold">{analytics.overview.totalUsers}</div>
            <div className="text-xs text-green-600">
              +{analytics.overview.newUsersThisMonth} this month
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Activity className="h-4 w-4" />
              Active (30d)
            </div>
            <div className="text-2xl font-bold">{analytics.overview.activeUsers30d}</div>
            <div className="text-xs text-gray-500">
              {analytics.overview.activeUsers7d} this week
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="h-4 w-4" />
              Return Rate
            </div>
            <div className="text-2xl font-bold">{analytics.overview.returnRate}%</div>
            <div className="text-xs text-gray-500">users with &gt;1 research</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <FileText className="h-4 w-4" />
              Research Runs
            </div>
            <div className="text-2xl font-bold">{analytics.overview.totalResearchRuns}</div>
            <div className="text-xs text-gray-500">
              {analytics.usage.avgRunsPerUser} avg/user
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <CreditCard className="h-4 w-4" />
              Credits Used
            </div>
            <div className="text-2xl font-bold">{analytics.usage.totalCreditsUsed}</div>
            <div className="text-xs text-gray-500">
              of {analytics.usage.totalCreditsPurchased} purchased
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
              <BarChart3 className="h-4 w-4" />
              Revenue
            </div>
            <div className="text-2xl font-bold text-green-700">
              ${analytics.revenue.totalRevenue.toFixed(2)}
            </div>
            <div className="text-xs text-green-600">
              ${analytics.revenue.revenueThisMonth.toFixed(2)} this month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Packs Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credit Pack Sales</CardTitle>
            <CardDescription>Breakdown by pack type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Starter Pack (3 credits)</div>
                  <div className="text-sm text-gray-500">$4.99</div>
                </div>
                <Badge variant="secondary">{analytics.revenue.creditsByType.starter} sold</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Builder Pack (10 credits)</div>
                  <div className="text-sm text-gray-500">$14.99</div>
                </div>
                <Badge variant="secondary">{analytics.revenue.creditsByType.builder} sold</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">Founder Pack (30 credits)</div>
                  <div className="text-sm text-gray-500">$39.99</div>
                </div>
                <Badge variant="secondary">{analytics.revenue.creditsByType.founder} sold</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Research Status</CardTitle>
            <CardDescription>Jobs by completion status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.usage.jobsByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <Badge
                    variant={
                      status === 'completed'
                        ? 'default'
                        : status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {status}
                  </Badge>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claude API Costs & Margin Analysis */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-orange-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5 text-orange-500" />
                Claude API Costs
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={onResetApiCosts}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
            <CardDescription>
              Token usage and API expenses
              {apiCostResetAt && (
                <span className="text-xs text-blue-600 block mt-1">
                  Tracking since: {new Date(apiCostResetAt).toLocaleDateString()} {new Date(apiCostResetAt).toLocaleTimeString()}
                  {onClearApiCostReset && (
                    <button
                      onClick={onClearApiCostReset}
                      className="ml-2 underline hover:text-blue-800"
                    >
                      (Show all time)
                    </button>
                  )}
                </span>
              )}
              {analytics.apiCosts.researchWithoutCostTracking > 0 && (
                <span className="text-xs text-amber-600 block mt-1">
                  * {analytics.apiCosts.researchWithoutCostTracking} research runs without cost tracking (pre-feature)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm text-orange-600">Total API Cost</div>
                  <div className="text-2xl font-bold text-orange-700">
                    ${analytics.apiCosts.totalApiCost.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Avg Cost/Research</div>
                  <div className="text-2xl font-bold">
                    ${analytics.apiCosts.avgCostPerResearch.toFixed(3)}
                  </div>
                </div>
              </div>

              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total API Calls</span>
                  <span className="font-medium">{analytics.apiCosts.totalApiCalls.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Input Tokens</span>
                  <span className="font-medium">{analytics.apiCosts.totalInputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Output Tokens</span>
                  <span className="font-medium">{analytics.apiCosts.totalOutputTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-500">Research Tracked</span>
                  <span className="font-medium">{analytics.apiCosts.researchWithCostTracking}</span>
                </div>
              </div>

              {analytics.apiCosts.costByModel.length > 0 && (
                <div className="border-t pt-4">
                  <div className="text-sm font-medium mb-2">Cost by Model</div>
                  <div className="space-y-2">
                    {analytics.apiCosts.costByModel.map((m) => (
                      <div key={m.model} className="flex justify-between text-sm">
                        <span className="text-gray-500 truncate max-w-[150px]">{m.model}</span>
                        <span className="font-mono">${m.cost.toFixed(3)} ({m.calls} calls)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={analytics.apiCosts.margins.grossMarginPercent >= 70 ? 'border-green-200 bg-green-50/50' : analytics.apiCosts.margins.grossMarginPercent >= 50 ? 'border-yellow-200 bg-yellow-50/50' : 'border-red-200 bg-red-50/50'}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {analytics.apiCosts.margins.grossMarginPercent >= 50 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              Margin Analysis
            </CardTitle>
            <CardDescription>Revenue vs API costs per credit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-sm text-gray-500 mb-1">Gross Margin</div>
                <div className={`text-3xl font-bold ${analytics.apiCosts.margins.grossMarginPercent >= 70 ? 'text-green-600' : analytics.apiCosts.margins.grossMarginPercent >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {analytics.apiCosts.margins.grossMarginPercent.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {analytics.apiCosts.margins.grossMarginPercent >= 70 ? 'Healthy margin' : analytics.apiCosts.margins.grossMarginPercent >= 50 ? 'Moderate margin' : 'Low margin - review pricing'}
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Avg Revenue/Credit</span>
                  <span className="font-medium text-green-600">
                    ${analytics.apiCosts.margins.avgRevenuePerCredit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Avg API Cost/Credit</span>
                  <span className="font-medium text-orange-600">
                    ${analytics.apiCosts.margins.avgCostPerCredit.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <span className="text-gray-500">Net Profit/Credit</span>
                  <span className={`font-bold ${analytics.apiCosts.margins.netProfitPerCredit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${analytics.apiCosts.margins.netProfitPerCredit.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-white/80 rounded-lg border text-xs text-gray-500">
                <DollarSign className="h-3 w-3 inline mr-1" />
                Based on {analytics.apiCosts.researchWithCostTracking} tracked research runs.
                {analytics.apiCosts.researchWithCostTracking === 0 && (
                  <span className="block mt-1 text-amber-600">
                    Run a new research to start tracking costs.
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Top Users by Research Activity</CardTitle>
            <CardDescription>Most active researchers</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onFetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">User</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Runs</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Balance</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Purchased</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {analytics.topUsers.map((user, i) => (
                  <tr key={user.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 font-mono text-sm">#{i + 1}</span>
                        <span className="font-medium">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{user.runs}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={user.credits > 0 ? 'default' : 'secondary'}>
                        {user.credits}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{user.purchased}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-gray-500 text-right">
            Last updated: {new Date(analytics.generatedAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
