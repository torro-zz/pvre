'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Check, Sparkles, Zap, Crown, Bell, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { CreditPack, CreditTransaction } from '@/types/database'

// Set to true when Lemon Squeezy is approved and ready
const BILLING_ENABLED = false

function BillingContent() {
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const searchParams = useSearchParams()

  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  useEffect(() => {
    const fetchData = async () => {
      // Fetch credit packs
      const packsRes = await fetch('/api/billing/packs')
      const packsData = await packsRes.json()
      setPacks(packsData.packs || [])

      // Fetch user's credits and transactions
      const creditsRes = await fetch('/api/billing/credits')
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json()
        setBalance(creditsData.balance || 0)
        setTransactions(creditsData.transactions || [])
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const handlePurchase = async (packId: string) => {
    if (!BILLING_ENABLED) return

    setPurchasing(packId)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Purchase failed:', error)
    } finally {
      setPurchasing(null)
    }
  }

  const getPackIcon = (name: string) => {
    if (name.toLowerCase().includes('founder')) return Crown
    if (name.toLowerCase().includes('builder')) return Zap
    return Sparkles
  }

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toFixed(0)}`
  }

  const getPricePerRun = (pack: CreditPack) => {
    return (pack.price_cents / 100 / pack.credits).toFixed(2)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-lg" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
        <p className="text-muted-foreground mt-1">
          Purchase credits and view your transaction history
        </p>
      </div>

      {/* Coming Soon Banner */}
      {!BILLING_ENABLED && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-200 dark:border-blue-500/30 px-6 py-4 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-full">
              <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Payments Coming Soon</h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                We&apos;re finalizing our payment system. Credit pack purchases will be available shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success/Cancel Messages */}
      {BILLING_ENABLED && success && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span className="font-medium">Payment successful!</span>
          </div>
          <p className="text-sm mt-1">Your credits have been added to your account.</p>
        </div>
      )}

      {BILLING_ENABLED && canceled && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-xl">
          Payment canceled. No charges were made.
        </div>
      )}

      {/* Hero: Current Balance */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5" />
        <CardHeader className="relative">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle>Current Balance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-emerald-600 dark:text-emerald-500">{balance}</span>
            <span className="text-xl text-muted-foreground">credits</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Each research run uses 1 credit
          </p>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {BILLING_ENABLED ? 'Purchase Credits' : 'Credit Packs'}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {packs.map((pack) => {
            const Icon = getPackIcon(pack.name)
            const isPopular = pack.badge_text?.toLowerCase().includes('popular')
            const isBestValue = pack.badge_text?.toLowerCase().includes('best')

            return (
              <Card
                key={pack.id}
                className={`relative transition-all hover:shadow-lg ${
                  isPopular ? 'ring-2 ring-primary shadow-md' : ''
                } ${!BILLING_ENABLED ? 'opacity-80' : ''}`}
              >
                {pack.badge_text && (
                  <Badge
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 ${
                      isBestValue
                        ? 'bg-emerald-500 hover:bg-emerald-500'
                        : 'bg-primary hover:bg-primary'
                    }`}
                  >
                    {pack.badge_text}
                  </Badge>
                )}
                <CardHeader className="text-center pt-8">
                  <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                    isPopular
                      ? 'bg-primary/10'
                      : isBestValue
                      ? 'bg-emerald-100 dark:bg-emerald-500/20'
                      : 'bg-muted'
                  }`}>
                    <Icon className={`w-7 h-7 ${
                      isPopular
                        ? 'text-primary'
                        : isBestValue
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`} />
                  </div>
                  <CardTitle className="text-xl">{pack.name}</CardTitle>
                  <CardDescription>{pack.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div>
                    <div className="text-4xl font-bold">{formatPrice(pack.price_cents)}</div>
                    <p className="text-muted-foreground mt-1">{pack.credits} research runs</p>
                  </div>

                  <div className="text-sm text-muted-foreground py-2 px-4 bg-muted/50 rounded-lg">
                    £{getPricePerRun(pack)} per run
                  </div>

                  {BILLING_ENABLED ? (
                    <Button
                      className="w-full"
                      onClick={() => handlePurchase(pack.id)}
                      disabled={purchasing !== null}
                      variant={isPopular ? 'default' : 'outline'}
                      size="lg"
                    >
                      {purchasing === pack.id ? 'Processing...' : 'Buy Now'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled
                      size="lg"
                    >
                      Coming Soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {BILLING_ENABLED
                  ? 'No transactions yet. Purchase credits to get started.'
                  : 'Your transaction history will appear here once payments are enabled.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {tx.description || tx.transaction_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {tx.amount > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground font-medium">
                        {tx.balance_after}
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

function BillingLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="h-32 bg-muted rounded-lg" />
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-muted rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingLoading />}>
      <BillingContent />
    </Suspense>
  )
}
