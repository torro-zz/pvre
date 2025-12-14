'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  CreditCard,
  BarChart3,
  Key,
  Bell,
  Shield,
} from 'lucide-react'

const accountNav = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/billing', label: 'Billing & Credits', icon: CreditCard },
  { href: '/account/usage', label: 'Usage', icon: BarChart3 },
  { href: '/account/api-keys', label: 'API Keys', icon: Key },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/privacy', label: 'Privacy & Data', icon: Shield },
]

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar */}
      <aside className="lg:w-64 flex-shrink-0">
        <nav className="space-y-1">
          {accountNav.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/account' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
