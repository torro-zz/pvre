'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  CreditCard,
  Search,
  Plus,
  Minus,
  Mail,
  Download,
  Trash2,
  AlertCircle,
  RefreshCw,
  FileText,
  BarChart3,
  TrendingUp,
  Activity,
  DollarSign,
  Cpu,
  TrendingDown,
  Shield,
  HeartPulse,
  Zap,
} from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  credits_balance: number
  total_credits_purchased: number
  total_research_runs: number
  created_at: string
  research_jobs: { count: number }[]
  total_spent_cents: number
  avg_spend_per_credit: string | null
}

interface WaitlistEntry {
  id: string
  email: string
  created_at: string
}

interface AnalyticsData {
  overview: {
    totalUsers: number
    newUsersThisMonth: number
    totalResearchRuns: number
    activeUsers30d: number
    activeUsers7d: number
    returnRate: number
  }
  revenue: {
    totalRevenue: number
    revenueThisMonth: number
    avgCreditsPerUser: number
    creditsByType: { starter: number; builder: number; founder: number; other: number }
  }
  usage: {
    totalCreditsUsed: number
    totalCreditsPurchased: number
    avgRunsPerUser: number
    jobsByStatus: Record<string, number>
  }
  apiCosts: {
    totalApiCost: number
    estimatedTotalApiCost: number
    totalApiCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    totalTokens: number
    researchWithCostTracking: number
    researchWithoutCostTracking: number
    avgCostPerResearch: number
    costByModel: { model: string; calls: number; cost: number }[]
    margins: {
      avgRevenuePerCredit: number
      avgCostPerCredit: number
      grossMarginPercent: number
      netProfitPerCredit: number
    }
  }
  topUsers: { email: string; runs: number; credits: number; purchased: number }[]
  generatedAt: string
}

interface OrphanedJob {
  id: string
  user_id: string
  user_email: string
  hypothesis: string
  status: string
  created_at: string
  issue: string
}

interface CreditAuditData {
  orphanedJobs: OrphanedJob[]
  staleJobs: OrphanedJob[]
  summary: {
    totalOrphaned: number
    totalStale: number
    creditsAtRisk: number
  }
  generatedAt: string
}

interface APIHealthData {
  pendingRefunds: number
  failedWithoutSource: number
  stuckProcessing: number
  errorSourceBreakdown: Record<string, number>
  staleThresholdMinutes: number
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [creditAudit, setCreditAudit] = useState<CreditAuditData | null>(null)
  const [creditAuditLoading, setCreditAuditLoading] = useState(false)
  const [apiHealth, setApiHealth] = useState<APIHealthData | null>(null)
  const [apiHealthLoading, setApiHealthLoading] = useState(false)
  const [apiHealthError, setApiHealthError] = useState<string | null>(null)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDescription, setCreditDescription] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Fetch users
  const fetchUsers = async (search = '') => {
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`)
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin access required. Make sure ADMIN_EMAIL is set in your environment.')
          return
        }
        throw new Error('Failed to fetch users')
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    }
  }

  // Fetch waitlist
  const fetchWaitlist = async () => {
    try {
      const res = await fetch('/api/admin/waitlist')
      if (!res.ok) throw new Error('Failed to fetch waitlist')
      const data = await res.json()
      setWaitlist(data.waitlist || [])
    } catch (err) {
      console.error('Failed to fetch waitlist:', err)
    }
  }

  // Fetch analytics
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch('/api/admin/analytics')
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  // Fetch credit audit data
  const fetchCreditAudit = async () => {
    setCreditAuditLoading(true)
    try {
      const res = await fetch('/api/admin/credit-audit')
      if (!res.ok) throw new Error('Failed to fetch credit audit')
      const data = await res.json()
      setCreditAudit(data)
    } catch (err) {
      console.error('Failed to fetch credit audit:', err)
    } finally {
      setCreditAuditLoading(false)
    }
  }

  // Fetch API health data
  const fetchApiHealth = async () => {
    setApiHealthLoading(true)
    setApiHealthError(null)
    try {
      const res = await fetch('/api/admin/cleanup-stale-jobs')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to fetch API health`)
      }
      const data = await res.json()
      setApiHealth(data)
    } catch (err) {
      console.error('Failed to fetch API health:', err)
      setApiHealthError(err instanceof Error ? err.message : 'Failed to fetch API health')
    } finally {
      setApiHealthLoading(false)
    }
  }

  // Run cleanup process
  const runCleanup = async () => {
    if (!confirm('This will auto-refund failed jobs with known error sources. Continue?')) return
    setCleanupRunning(true)
    try {
      const res = await fetch('/api/admin/cleanup-stale-jobs', { method: 'POST' })
      if (!res.ok) throw new Error('Cleanup failed')
      const data = await res.json()
      alert(`Cleanup complete: ${data.message}`)
      // Refresh health stats
      await fetchApiHealth()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cleanup failed')
    } finally {
      setCleanupRunning(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchWaitlist()])
      setLoading(false)
    }
    loadData()
  }, [])

  const handleSearch = () => {
    fetchUsers(searchQuery)
  }

  const handleAddCredits = async () => {
    if (!selectedUser || !creditAmount) return

    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          credits: parseInt(creditAmount),
          description: creditDescription || undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to add credits')

      const data = await res.json()
      alert(data.message)

      // Refresh users
      await fetchUsers(searchQuery)
      setSelectedUser(null)
      setCreditAmount('')
      setCreditDescription('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add credits')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteWaitlistEntry = async (id: string) => {
    if (!confirm('Remove this email from waitlist?')) return

    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) throw new Error('Failed to delete')

      await fetchWaitlist()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const exportWaitlistCSV = () => {
    const csv = ['email,created_at']
      .concat(waitlist.map((w) => `${w.email},${w.created_at}`))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pvre-waitlist.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
            <p className="text-red-600 mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p>Loading admin panel...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage users, credits, and view waitlist</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{users.length}</div>
            <div className="text-sm text-gray-500">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u.credits_balance, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Credits</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {users.reduce((sum, u) => sum + u.total_research_runs, 0)}
            </div>
            <div className="text-sm text-gray-500">Research Runs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{waitlist.length}</div>
            <div className="text-sm text-gray-500">Waitlist Signups</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Add Credits
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-2">
            <Mail className="h-4 w-4" />
            Waitlist ({waitlist.length})
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2">
            <FileText className="h-4 w-4" />
            Research
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2" onClick={() => !analytics && fetchAnalytics()}>
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2" onClick={() => !creditAudit && fetchCreditAudit()}>
            <Shield className="h-4 w-4" />
            Credit Audit
          </TabsTrigger>
          <TabsTrigger value="api-health" className="gap-2" onClick={() => !apiHealth && fetchApiHealth()}>
            <HeartPulse className="h-4 w-4" />
            API Health
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage user accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch}>Search</Button>
              </div>

              {/* Users Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">User</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Credits</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">$/Credit</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Runs</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Joined</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{user.email}</div>
                          <div className="text-sm text-gray-500">{user.full_name || 'No name'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant={user.credits_balance > 0 ? 'default' : 'secondary'}>
                            {user.credits_balance}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {user.avg_spend_per_credit ? `$${user.avg_spend_per_credit}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {user.total_research_runs}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Credits
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Credits Tab */}
        <TabsContent value="credits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add/Deduct Credits</CardTitle>
              <CardDescription>
                {selectedUser
                  ? `Managing credits for ${selectedUser.email}`
                  : 'Select a user from the Users tab first'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <div className="space-y-4 max-w-md">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Selected User</div>
                    <div className="font-medium">{selectedUser.email}</div>
                    <div className="text-sm">
                      Current balance: <strong>{selectedUser.credits_balance} credits</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Credits to Add/Deduct</label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditAmount('1')}
                      >
                        +1
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditAmount('5')}
                      >
                        +5
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditAmount('10')}
                      >
                        +10
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditAmount('-1')}
                      >
                        -1
                      </Button>
                    </div>
                    <Input
                      type="number"
                      placeholder="Enter amount (negative to deduct)"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Input
                      placeholder="e.g., Beta tester bonus"
                      value={creditDescription}
                      onChange={(e) => setCreditDescription(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddCredits}
                      disabled={actionLoading || !creditAmount}
                    >
                      {parseInt(creditAmount || '0') >= 0 ? (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Credits
                        </>
                      ) : (
                        <>
                          <Minus className="h-4 w-4 mr-2" />
                          Deduct Credits
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(null)
                        setCreditAmount('')
                        setCreditDescription('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a user from the Users tab to manage their credits</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Waitlist Tab */}
        <TabsContent value="waitlist" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Billing Waitlist</CardTitle>
                <CardDescription>{waitlist.length} people waiting for billing</CardDescription>
              </div>
              {waitlist.length > 0 && (
                <Button variant="outline" onClick={exportWaitlistCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {waitlist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No waitlist signups yet</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Email</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Signed Up</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {waitlist.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{entry.email}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteWaitlistEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Research Tab - Link to debug page */}
        <TabsContent value="research" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Research Debug</CardTitle>
              <CardDescription>View detailed research data and results</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                The research debug page shows detailed information about all research jobs,
                including pain signals, scores, and raw data.
              </p>
              <Button asChild>
                <a href="/admin/debug">
                  <FileText className="h-4 w-4 mr-2" />
                  Open Research Debug Page
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-6">
          {analyticsLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p>Loading analytics...</p>
              </CardContent>
            </Card>
          ) : analytics ? (
            <>
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
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-orange-500" />
                      Claude API Costs
                    </CardTitle>
                    <CardDescription>
                      Token usage and API expenses
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
                  <Button variant="outline" size="sm" onClick={fetchAnalytics}>
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
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">Click to load analytics data</p>
                <Button onClick={fetchAnalytics}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Load Analytics
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Credit Audit Tab */}
        <TabsContent value="audit" className="mt-4 space-y-6">
          {creditAuditLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-400" />
                <p className="text-gray-500">Loading credit audit data...</p>
              </CardContent>
            </Card>
          ) : creditAudit ? (
            <>
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
                <Button variant="outline" onClick={fetchCreditAudit}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Audit
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-right">
                Last updated: {new Date(creditAudit.generatedAt).toLocaleString()}
              </p>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">Click to load credit audit data</p>
                <Button onClick={fetchCreditAudit}>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Credit Audit
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* API Health Tab */}
        <TabsContent value="api-health" className="mt-4 space-y-6">
          {apiHealthLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-gray-400" />
                <p className="text-gray-500">Loading API health data...</p>
              </CardContent>
            </Card>
          ) : apiHealth ? (
            <>
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
                      onClick={runCleanup}
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
                    <Button variant="outline" size="sm" onClick={fetchApiHealth}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Stats
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : apiHealthError ? (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-700 font-medium mb-2">Failed to Load API Health</p>
                <p className="text-red-600 text-sm mb-4">{apiHealthError}</p>
                <Button onClick={fetchApiHealth} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <HeartPulse className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">Click to check API health status</p>
                <Button onClick={fetchApiHealth}>
                  <HeartPulse className="h-4 w-4 mr-2" />
                  Check API Health
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
