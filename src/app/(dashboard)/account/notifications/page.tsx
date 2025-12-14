'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, Mail, Monitor, Moon, Sun, Palette } from 'lucide-react'

interface NotificationPreferences {
  email_research_complete: boolean
  email_low_credits: boolean
  email_product_updates: boolean
  email_tips_and_tutorials: boolean
}

const notificationOptions = [
  {
    key: 'email_research_complete' as const,
    label: 'Research Complete',
    description: 'Get notified when your research runs are finished',
    category: 'essential',
    channel: 'email',
  },
  {
    key: 'email_low_credits' as const,
    label: 'Low Credits',
    description: 'Get notified when your credit balance is running low',
    category: 'essential',
    channel: 'email',
  },
  {
    key: 'email_product_updates' as const,
    label: 'Product Updates',
    description: 'Stay informed about new features and improvements',
    category: 'marketing',
    channel: 'email',
  },
  {
    key: 'email_tips_and_tutorials' as const,
    label: 'Tips & Tutorials',
    description: 'Receive helpful tips to get more from PVRE',
    category: 'marketing',
    channel: 'email',
  },
]

export default function NotificationsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_research_complete: true,
    email_low_credits: true,
    email_product_updates: false,
    email_tips_and_tutorials: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchPreferences = async () => {
      const res = await fetch('/api/account/notifications')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences)
      }
      setLoading(false)
    }

    fetchPreferences()
  }, [])

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch('/api/account/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-secondary rounded" />
        <div className="h-64 bg-secondary rounded-lg" />
      </div>
    )
  }

  const themeOptions = [
    { value: 'system', label: 'System', icon: Monitor, description: 'Follow system settings' },
    { value: 'light', label: 'Light', icon: Sun, description: 'Always use light mode' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Always use dark mode' },
  ]

  const essentialOptions = notificationOptions.filter((o) => o.category === 'essential')
  const marketingOptions = notificationOptions.filter((o) => o.category === 'marketing')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your preferences.</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose how PVRE looks to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mounted && (
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon
                const isSelected = theme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      {option.description}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Essential Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Essential Notifications
          </CardTitle>
          <CardDescription>
            Important notifications about your account and research.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {essentialOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences[option.key]}
                  onChange={() => handleToggle(option.key)}
                />
                <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Marketing Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Marketing & Updates</CardTitle>
          <CardDescription>
            Optional emails to help you get more from PVRE.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {marketingOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg cursor-pointer hover:bg-secondary"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences[option.key]}
                  onChange={() => handleToggle(option.key)}
                />
                <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            'Saving...'
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  )
}
