'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, BarChart3, Clock, ArrowRight, MessageCircle } from 'lucide-react'

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Overview</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and view your usage.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Credits Balance
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.creditsBalance || 0}</div>
            <Link
              href="/account/billing"
              className="text-sm text-primary hover:underline mt-2 inline-flex items-center gap-1"
            >
              Buy more credits <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Research Runs
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRuns || 0}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Total runs completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Member Since
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats?.memberSince || '-'}</div>
            <p className="text-sm text-muted-foreground mt-2">
              {stats?.totalPurchased || 0} credits purchased
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold text-foreground">Need more credits?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Purchase credit packs to continue running research.
          </p>
          <Link href="/account/billing">
            <Button className="mt-4">View Credit Packs</Button>
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-foreground">Start New Research</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Validate your next business hypothesis with AI-powered research.
          </p>
          <Link href="/research">
            <Button variant="outline" className="mt-4">Run Research</Button>
          </Link>
        </Card>
      </div>

      {/* Support Section */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg">
            <MessageCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Need Help?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Have questions or feedback? Click the chat bubble in the corner to reach us.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
