'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  const supabase = useMemo(() => {
    if (typeof window !== 'undefined') {
      return createClient()
    }
    return null
  }, [])

  useEffect(() => {
    setMounted(true)
    if (!supabase) return

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold">
          PVRE
        </Link>
        <nav className="flex items-center gap-4">
          {mounted && user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
