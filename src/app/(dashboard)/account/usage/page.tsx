'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Clock, ExternalLink } from 'lucide-react'
import type { ResearchJob } from '@/types/database'

interface UsageStats {
  totalRuns: number
  thisMonthRuns: number
  creditsUsed: number
}

export default function UsagePage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([])
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Fetch research jobs
        const { data: researchJobs } = await supabase
          .from('research_jobs')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)

        setJobs(researchJobs || [])

        // Calculate stats
        const allJobs = researchJobs || []
        const now = new Date()
        const thisMonthJobs = allJobs.filter((job) => {
          const jobDate = new Date(job.created_at)
          return jobDate.getMonth() === now.getMonth() &&
                 jobDate.getFullYear() === now.getFullYear()
        })

        setStats({
          totalRuns: allJobs.length,
          thisMonthRuns: thisMonthJobs.length,
          creditsUsed: allJobs.filter((j) => j.status === 'completed').length,
        })
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const getStatusBadge = (status: ResearchJob['status']) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      processing: 'bg-blue-100 text-blue-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usage Statistics</h1>
        <p className="text-gray-500 mt-1">Track your research activity and credit usage.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Research Runs
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRuns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              This Month
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.thisMonthRuns || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Credits Used
            </CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.creditsUsed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Research History */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Research History</h2>
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gray-500 mb-4">No research runs yet.</p>
              <Link href="/research">
                <Button>Start Your First Research</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Hypothesis</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(job.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                        {job.hypothesis}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {job.status === 'completed' && (
                          <Link
                            href={`/research/${job.id}`}
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
