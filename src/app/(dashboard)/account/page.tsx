'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, BarChart3, Clock, ArrowRight, MessageCircle, ExternalLink } from 'lucide-react'

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

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
            memberSince: new Date(profile.created_at).toLocaleDateString('en-US', {
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
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Overview</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and view your usage.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Credits Balance
            </CardTitle>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.creditsBalance || 0}</div>
            <Link
              href="/account/billing"
              className="text-sm text-blue-600 hover:underline mt-2 inline-flex items-center gap-1"
            >
              Buy more credits <ArrowRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Research Runs
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalRuns || 0}</div>
            <p className="text-sm text-gray-500 mt-2">
              Total runs completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Member Since
            </CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{stats?.memberSince || '-'}</div>
            <p className="text-sm text-gray-500 mt-2">
              {stats?.totalPurchased || 0} credits purchased
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900">Need more credits?</h3>
          <p className="text-sm text-gray-500 mt-1">
            Purchase credit packs to continue running research.
          </p>
          <Link href="/account/billing">
            <Button className="mt-4">View Credit Packs</Button>
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900">Start New Research</h3>
          <p className="text-sm text-gray-500 mt-1">
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
          <div className="p-3 bg-green-100 rounded-lg">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Need Help?</h3>
            <p className="text-sm text-gray-500 mt-1">
              Have questions or feedback? We're here to help.
            </p>
            {process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4"
              >
                <Button variant="outline" className="gap-2">
                  <WhatsAppIcon className="h-4 w-4 text-green-600" />
                  Chat on WhatsApp
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            ) : (
              <p className="text-sm text-gray-400 mt-4">
                Contact support coming soon
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
