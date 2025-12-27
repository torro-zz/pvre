'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useSidebar } from '@/contexts/sidebar-context'
import { cn } from '@/lib/utils'
import {
  Home,
  FileText,
  GitCompare,
  Settings,
  CreditCard,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FolderList } from '@/components/folders'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/account/usage', label: 'All Research', icon: FileText },
  { href: '/comparison', label: 'Compare', icon: GitCompare },
]

const bottomNavItems: NavItem[] = [
  { href: '/account/profile', label: 'Settings', icon: Settings },
  { href: '/account/billing', label: 'Billing', icon: CreditCard },
  { href: 'https://pvre.canny.io', label: 'Help', icon: HelpCircle },
]

function NavLink({
  item,
  isCollapsed,
  isActive,
}: {
  item: NavItem
  isCollapsed: boolean
  isActive: boolean
}) {
  const Icon = item.icon
  const isExternal = item.href.startsWith('http')

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
        'hover:bg-primary/10 group',
        isActive && 'bg-primary/10 text-primary font-medium',
        !isActive && 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        )}
      />
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {item.badge && !isCollapsed && (
        <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </div>
  )

  if (isExternal) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return <Link href={item.href}>{content}</Link>
}

function SidebarContent({ isCollapsed }: { isCollapsed: boolean }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn('px-4 py-5 border-b', isCollapsed && 'px-3 flex justify-center')}>
        <Link href="/dashboard" className="flex items-center">
          <motion.span
            className="font-bold text-xl text-primary whitespace-nowrap overflow-hidden"
            initial={false}
            animate={{ width: isCollapsed ? '20px' : 'auto' }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {isCollapsed ? 'P' : 'PVRE'}
          </motion.span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="px-3 py-4 space-y-1">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
          />
        ))}
      </nav>

      {/* Folders Section */}
      <div className="flex-1 border-t overflow-y-auto">
        <FolderList isCollapsed={isCollapsed} />
      </div>

      {/* Bottom Navigation */}
      <div className="px-3 py-4 border-t space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            isActive={pathname === item.href}
          />
        ))}
      </div>
    </div>
  )
}

export function Sidebar() {
  const { isCollapsed, toggleCollapsed, isMobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'hidden md:flex flex-col bg-card border-r h-screen sticky top-0',
          'shadow-sm'
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />

        {/* Collapse Toggle */}
        <div className="px-3 py-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className={cn(
              'w-full flex items-center gap-2 text-muted-foreground hover:text-foreground',
              isCollapsed && 'justify-center px-0'
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </motion.aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Mobile Sidebar */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-card z-50 md:hidden shadow-xl"
            >
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>

              <SidebarContent isCollapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
