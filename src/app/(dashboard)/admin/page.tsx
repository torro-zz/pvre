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
  topUsers: { email: string; runs: number; credits: number; purchased: number }[]
  generatedAt: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
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
      </Tabs>
    </div>
  )
}
