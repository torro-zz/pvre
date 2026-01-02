'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Loader2, CheckCircle2, Sparkles, ArrowRight, Bug } from 'lucide-react'

const isDev = process.env.NODE_ENV !== 'production'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [devLoading, setDevLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDevLogin = async () => {
    setDevLoading(true)
    try {
      const res = await fetch('/api/dev/login', { method: 'POST', credentials: 'include' })
      if (res.ok) {
        window.location.href = '/dashboard'
      } else {
        setError('Dev login failed')
      }
    } catch {
      setError('Dev login failed')
    } finally {
      setDevLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (signInError) {
        throw signInError
      }

      setEmailSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Check your email</h2>
                <p className="text-muted-foreground">
                  We sent a magic link to
                </p>
                <p className="font-medium text-foreground">{email}</p>
              </div>
              <div className="pt-2 pb-4">
                <p className="text-sm text-muted-foreground">
                  Click the link in the email to sign in. You can close this tab.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setEmailSent(false)
                  setEmail('')
                }}
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                Use a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Brand */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to PVRE</h1>
          <p className="text-muted-foreground">
            Pre-Validation Research Engine
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Sign in to continue</CardTitle>
            <CardDescription>
              Get automated market research in minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <Button
              onClick={handleGoogleLogin}
              className="w-full h-12 text-base"
              size="lg"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-3">
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="h-12"
              />
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="outline"
                className="w-full h-12 text-base"
                size="lg"
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send magic link
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground pt-2">
              No password needed - we&apos;ll email you a secure link
            </p>

            {/* Dev Login Button - only shows in development */}
            {isDev && (
              <>
                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-dashed border-amber-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-amber-600">dev only</span>
                  </div>
                </div>
                <Button
                  onClick={handleDevLogin}
                  variant="outline"
                  className="w-full h-10 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/50"
                  disabled={devLoading}
                >
                  {devLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bug className="mr-2 h-4 w-4" />
                  )}
                  Dev Login (Test User)
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
