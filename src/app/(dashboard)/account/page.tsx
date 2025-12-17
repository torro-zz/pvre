'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { CreditCard, BarChart3, Clock, ArrowRight, MessageCircle, Sparkles, TrendingUp } from 'lucide-react'

interface AccountStats {
  creditsBalance: number
  totalRuns: number
  totalPurchased: number
  memberSince: string
}

export default function AccountPage() {
  const [stats, setStats] = useState<AccountStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_balance, total_research_runs, total_credits_purchased, created_at')
          .eq('id', user.id)
          .single()

        if (profile) {
          setStats({
            creditsBalance: profile.credits_balance || 0,
            totalRuns: profile.total_research_runs || 0,
            totalPurchased: profile.total_credits_purchased || 0,
            memberSince: new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            }),
          })
        }
      }
      setLoading(false)
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Overview</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and view your usage
        </p>
      </div>

      {/* Stats Row with Hero Credit Card */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Hero: Credits Balance */}
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5" />
          <CardHeader className="relative flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credits Balance
            </CardTitle>
            <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20">
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-500">
              {stats?.creditsBalance || 0}
            </div>
            <Link
              href="/account/billing"
              className="text-sm text-primary hover:underline mt-3 inline-flex items-center gap-1"
            >
              Buy more credits <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Research Runs */}
        <StatCard
          label="Research Runs"
          value={stats?.totalRuns || 0}
          subValue="completed"
          icon={BarChart3}
          size="lg"
        />

        {/* Member Since */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Member Since
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats?.memberSince || '-'}</div>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              {stats?.totalPurchased || 0} credits purchased
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Need more credits?</CardTitle>
            </div>
            <CardDescription>
              Purchase credit packs to continue running research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/account/billing">
              <Button className="w-full sm:w-auto">
                View Credit Packs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-lg">Start New Research</CardTitle>
            </div>
            <CardDescription>
              Validate your next business hypothesis with AI-powered research
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/research">
              <Button variant="outline" className="w-full sm:w-auto">
                Run Research
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Support Section */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
              <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Need Help?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Have questions or feedback? Click the chat bubble in the corner to reach us.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
