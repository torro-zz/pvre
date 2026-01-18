'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Check } from 'lucide-react'

export function WaitlistForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/waitlist-count')
      .then((res) => res.json())
      .then((data) => setCount(data.count))
      .catch(() => setCount(21))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setError('You\'re already on the list!')
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      setIsSuccess(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Check className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-lg font-medium text-foreground">You're on the list!</p>
        <p className="text-sm text-muted-foreground">Check your email for updates.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-muted-foreground mb-4 text-center">
        {count !== null
          ? `Join ${count.toLocaleString()} founders validating ideas faster`
          : 'Join founders validating ideas faster'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
          className="h-12 text-base"
        />
        <Input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
          className="h-12 text-base"
        />
        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : (
            'Join the Waitlist'
          )}
        </Button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-destructive text-center">{error}</p>
      )}

      <p className="text-xs text-muted-foreground mt-4 text-center">
        We'll notify you when early access opens. No spam.
      </p>
    </div>
  )
}
