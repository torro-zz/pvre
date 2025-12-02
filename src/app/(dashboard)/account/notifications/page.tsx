'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, Mail } from 'lucide-react'

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
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  const essentialOptions = notificationOptions.filter((o) => o.category === 'essential')
  const marketingOptions = notificationOptions.filter((o) => o.category === 'marketing')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
        <p className="text-gray-500 mt-1">Choose what emails you'd like to receive.</p>
      </div>

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
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences[option.key]}
                  onChange={() => handleToggle(option.key)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences[option.key]}
                  onChange={() => handleToggle(option.key)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
