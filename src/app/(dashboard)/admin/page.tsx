'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  CreditCard,
  Mail,
  AlertCircle,
  RefreshCw,
  FileText,
  BarChart3,
  Shield,
  HeartPulse,
} from 'lucide-react'
import {
  UsersTab,
  CreditsTab,
  WaitlistTab,
  AnalyticsTab,
  CreditAuditTab,
  APIHealthTab,
  type User,
  type WaitlistEntry,
  type AnalyticsData,
  type CreditAuditData,
  type APIHealthData,
} from '@/components/admin'

export default function AdminPage() {
  // Core state
  const [users, setUsers] = useState<User[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // User management state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDescription, setCreditDescription] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Credit audit state
  const [creditAudit, setCreditAudit] = useState<CreditAuditData | null>(null)
  const [creditAuditLoading, setCreditAuditLoading] = useState(false)

  // API health state
  const [apiHealth, setApiHealth] = useState<APIHealthData | null>(null)
  const [apiHealthLoading, setApiHealthLoading] = useState(false)
  const [apiHealthError, setApiHealthError] = useState<string | null>(null)
  const [cleanupRunning, setCleanupRunning] = useState(false)

  // Fetch functions
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

  const runCleanup = async () => {
    if (!confirm('This will auto-refund failed jobs with known error sources. Continue?')) return
    setCleanupRunning(true)
    try {
      const res = await fetch('/api/admin/cleanup-stale-jobs', { method: 'POST' })
      if (!res.ok) throw new Error('Cleanup failed')
      const data = await res.json()
      alert(`Cleanup complete: ${data.message}`)
      await fetchApiHealth()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Cleanup failed')
    } finally {
      setCleanupRunning(false)
    }
  }

  // Event handlers
  const handleSearch = () => fetchUsers(searchQuery)

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

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchUsers(), fetchWaitlist()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Error state
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

  // Loading state
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

        <TabsContent value="users" className="mt-4">
          <UsersTab
            users={users}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            onSelectUser={setSelectedUser}
          />
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <CreditsTab
            selectedUser={selectedUser}
            creditAmount={creditAmount}
            creditDescription={creditDescription}
            actionLoading={actionLoading}
            onCreditAmountChange={setCreditAmount}
            onDescriptionChange={setCreditDescription}
            onAddCredits={handleAddCredits}
            onCancel={() => {
              setSelectedUser(null)
              setCreditAmount('')
              setCreditDescription('')
            }}
          />
        </TabsContent>

        <TabsContent value="waitlist" className="mt-4">
          <WaitlistTab
            waitlist={waitlist}
            onDelete={handleDeleteWaitlistEntry}
            onExportCSV={exportWaitlistCSV}
          />
        </TabsContent>

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

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab
            analytics={analytics}
            loading={analyticsLoading}
            onFetch={fetchAnalytics}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <CreditAuditTab
            creditAudit={creditAudit}
            loading={creditAuditLoading}
            onFetch={fetchCreditAudit}
          />
        </TabsContent>

        <TabsContent value="api-health" className="mt-4">
          <APIHealthTab
            apiHealth={apiHealth}
            loading={apiHealthLoading}
            error={apiHealthError}
            cleanupRunning={cleanupRunning}
            onFetch={fetchApiHealth}
            onCleanup={runCleanup}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
