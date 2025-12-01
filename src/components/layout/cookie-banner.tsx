'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Cookie, X } from 'lucide-react'

export function CookieBanner() {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if user has already consented
    const hasConsented = localStorage.getItem('cookie_consent')
    if (!hasConsented) {
      setShow(true)
    }
  }, [])

  const handleAccept = async () => {
    localStorage.setItem('cookie_consent', 'all')
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShow(false)

    // Update user profile if logged in
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ cookie_consent_at: new Date().toISOString() })
        .eq('id', user.id)
    }
  }

  const handleNecessaryOnly = () => {
    localStorage.setItem('cookie_consent', 'necessary')
    localStorage.setItem('cookie_consent_date', new Date().toISOString())
    setShow(false)
  }

  const handleDismiss = () => {
    setShow(false)
  }

  if (!mounted || !show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t shadow-lg">
      <div className="container mx-auto max-w-4xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Cookie className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
            <div>
              <p className="text-sm text-gray-600">
                We use cookies to enhance your experience and analyze site usage.
                By continuing to use this site, you agree to our use of cookies.
              </p>
              <a
                href="/privacy"
                className="text-sm text-blue-600 hover:underline"
              >
                Learn more
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNecessaryOnly}
            >
              Necessary Only
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
            >
              Accept All
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
