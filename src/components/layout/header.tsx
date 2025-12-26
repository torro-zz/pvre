'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { CreditCard, User as UserIcon, Settings, LogOut, ChevronDown, Shield, Menu } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { useSidebar } from '@/contexts/sidebar-context'

// Check if user is admin (client-side)
function isAdminEmail(email: string | null | undefined): boolean {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (!adminEmail || !email) return false
  return email.toLowerCase() === adminEmail.toLowerCase()
}

export function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  // Sidebar context for mobile hamburger - wrapped in try/catch for pages without sidebar
  let sidebarContext: { setMobileOpen: (open: boolean) => void } | null = null
  try {
    sidebarContext = useSidebar()
  } catch {
    // Not in sidebar context (e.g., landing page)
  }

  const supabase = useMemo(() => {
    if (typeof window !== 'undefined') {
      return createClient()
    }
    return null
  }, [])

  useEffect(() => {
    setMounted(true)
    if (!supabase) return

    let profileSubscription: ReturnType<typeof supabase.channel> | null = null

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_balance')
          .eq('id', user.id)
          .single()
        setCredits(profile?.credits_balance ?? 0)

        // Subscribe to real-time updates for this user's profile
        profileSubscription = supabase
          .channel(`profile-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`
            },
            (payload) => {
              const newCredits = (payload.new as { credits_balance?: number }).credits_balance
              if (typeof newCredits === 'number') {
                setCredits(newCredits)
              }
            }
          )
          .subscribe()
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setCredits(null)
        profileSubscription?.unsubscribe()
        profileSubscription = null
      }
    })

    return () => {
      subscription.unsubscribe()
      profileSubscription?.unsubscribe()
    }
  }, [supabase])

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4">
        {/* Left side - Hamburger menu for mobile */}
        <div className="flex items-center gap-3">
          {sidebarContext && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => sidebarContext?.setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          )}
          {/* Show logo only on mobile (sidebar has logo on desktop) */}
          <Link href="/dashboard" className="text-xl font-bold md:hidden">
            PVRE
          </Link>
        </div>

        <nav className="flex items-center gap-4">
          <ThemeToggle />
          {mounted && user ? (
            <>

              {/* Credits Badge with warning states */}
              <Link
                href="/account/billing"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  credits !== null && credits <= 1
                    ? 'bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-400'
                    : credits !== null && credits <= 3
                    ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:hover:bg-yellow-900 dark:text-yellow-400'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
              >
                <CreditCard className={`w-4 h-4 ${
                  credits !== null && credits <= 1
                    ? 'text-red-500 dark:text-red-400'
                    : credits !== null && credits <= 3
                    ? 'text-yellow-500 dark:text-yellow-400'
                    : 'text-muted-foreground'
                }`} />
                <span>{credits ?? '...'} credits</span>
                {credits !== null && credits <= 3 && (
                  <span className="text-xs ml-1">· Get More</span>
                )}
              </Link>

              {/* Account Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-popover rounded-lg shadow-lg border py-1 z-20">
                      <Link
                        href="/account"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-secondary"
                      >
                        <UserIcon className="w-4 h-4" />
                        Account
                      </Link>
                      <Link
                        href="/account/billing"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-secondary"
                      >
                        <CreditCard className="w-4 h-4" />
                        Billing
                      </Link>
                      <Link
                        href="/account/notifications"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-secondary"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      {isAdminEmail(user?.email) && (
                        <Link
                          href="/admin"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950"
                        >
                          <Shield className="w-4 h-4" />
                          Admin
                        </Link>
                      )}
                      <hr className="my-1 border-border" />
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          handleSignOut()
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-secondary w-full"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
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
