'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, Zap, ExternalLink, CheckCircle2, Loader2, XCircle, Clock, Sparkles, ArrowRight } from 'lucide-react'
import type { Tables } from '@/types/supabase'

type ResearchJob = Tables<'research_jobs'>

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
          if (!job.created_at) return false
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

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage Statistics</h1>
        <p className="text-muted-foreground mt-1">
          Track your research activity and credit usage
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Research Runs
            </CardTitle>
            <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-500/20">
              <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold">{stats?.totalRuns || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-500">
              {stats?.thisMonthRuns || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().toLocaleString('default', { month: 'long' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credits Used
            </CardTitle>
            <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats?.creditsUsed || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed runs</p>
          </CardContent>
        </Card>
      </div>

      {/* Research History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Research History</h2>
          {jobs.length > 0 && (
            <Link href="/research">
              <Button variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                New Research
              </Button>
            </Link>
          )}
        </div>

        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No research runs yet</h3>
              <p className="text-muted-foreground mb-4">
                Start your first research to see your history here
              </p>
              <Link href="/research">
                <Button>
                  Start Your First Research
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hypothesis</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {job.created_at ? new Date(job.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-md">
                        <span className="line-clamp-1">{job.hypothesis}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(job.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(job.status === 'completed' || job.status === 'processing') && (
                          <Link href={`/research/${job.id}`}>
                            <Button variant="ghost" size="sm" className="text-primary">
                              View
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
