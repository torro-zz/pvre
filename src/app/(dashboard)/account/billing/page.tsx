'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreditCard, Check, Sparkles, Zap, Crown, Bell, Mail } from 'lucide-react'
import type { CreditPack, CreditTransaction } from '@/types/database'

// Set to true when Lemon Squeezy is approved and ready
const BILLING_ENABLED = false

function BillingContent() {
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
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

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistEmail || waitlistSubmitting) return

    setWaitlistSubmitting(true)
    setWaitlistError('')

    try {
      const res = await fetch('/api/billing/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail }),
      })

      if (res.ok) {
        setWaitlistSuccess(true)
        setWaitlistEmail('')
      } else {
        const data = await res.json()
        setWaitlistError(data.error || 'Failed to join waitlist')
      }
    } catch {
      setWaitlistError('Something went wrong. Please try again.')
    } finally {
      setWaitlistSubmitting(false)
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
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Credits</h1>
        <p className="text-gray-500 mt-1">Purchase credits and view your transaction history.</p>
      </div>

      {/* Coming Soon Banner */}
      {!BILLING_ENABLED && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-6 py-4 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Payments Coming Soon</h3>
              <p className="text-blue-700 text-sm mt-1">
                We&apos;re finalizing our payment system. Join the waitlist below to be notified when credit packs are available for purchase.
              </p>

              {waitlistSuccess ? (
                <div className="mt-4 flex items-center gap-2 text-green-700">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">You&apos;re on the list! We&apos;ll notify you when payments go live.</span>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="mt-4 flex gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={waitlistSubmitting}>
                    {waitlistSubmitting ? 'Joining...' : 'Notify Me'}
                  </Button>
                </form>
              )}
              {waitlistError && (
                <p className="mt-2 text-sm text-red-600">{waitlistError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success/Cancel Messages (only when billing enabled) */}
      {BILLING_ENABLED && success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span className="font-medium">Payment successful!</span>
          </div>
          <p className="text-sm mt-1">Your credits have been added to your account.</p>
        </div>
      )}

      {BILLING_ENABLED && canceled && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          Payment canceled. No charges were made.
        </div>
      )}

      {/* Current Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">{balance} credits</div>
          <p className="text-gray-500 mt-1">
            Each research run uses 1 credit
          </p>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {BILLING_ENABLED ? 'Purchase Credits' : 'Credit Packs (Coming Soon)'}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {packs.map((pack) => {
            const Icon = getPackIcon(pack.name)
            const isPopular = pack.badge_text?.toLowerCase().includes('popular')
            const isBestValue = pack.badge_text?.toLowerCase().includes('best')

            return (
              <Card
                key={pack.id}
                className={`relative ${isPopular ? 'ring-2 ring-blue-500' : ''} ${!BILLING_ENABLED ? 'opacity-75' : ''}`}
              >
                {pack.badge_text && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-semibold rounded-full ${
                    isBestValue ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                  }`}>
                    {pack.badge_text}
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-gray-600" />
                  </div>
                  <CardTitle>{pack.name}</CardTitle>
                  <CardDescription>{pack.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="text-4xl font-bold">{formatPrice(pack.price_cents)}</div>
                  <p className="text-gray-500 mt-1">{pack.credits} research runs</p>
                  <p className="text-sm text-gray-400 mt-1">£{getPricePerRun(pack)} per run</p>

                  {BILLING_ENABLED ? (
                    <Button
                      className="w-full mt-6"
                      onClick={() => handlePurchase(pack.id)}
                      disabled={purchasing !== null}
                      variant={isPopular ? 'default' : 'outline'}
                    >
                      {purchasing === pack.id ? 'Processing...' : 'Buy Now'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-6"
                      variant="outline"
                      disabled
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              {BILLING_ENABLED
                ? 'No transactions yet. Purchase credits to get started.'
                : 'Your transaction history will appear here once payments are enabled.'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Description</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Amount</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {tx.description || tx.transaction_type}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {tx.balance_after}
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

function BillingLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded" />
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-gray-200 rounded-lg" />
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
