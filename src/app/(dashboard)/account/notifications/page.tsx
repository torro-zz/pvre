'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Check, Mail, MessageCircle } from 'lucide-react'

// WhatsApp icon component
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

interface NotificationPreferences {
  email_research_complete: boolean
  email_low_credits: boolean
  email_product_updates: boolean
  email_tips_and_tutorials: boolean
  whatsapp_research_complete: boolean
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

const whatsappOptions = [
  {
    key: 'whatsapp_research_complete' as const,
    label: 'Research Complete (WhatsApp)',
    description: 'Get a WhatsApp message when your research is ready',
    category: 'whatsapp',
    channel: 'whatsapp',
  },
]

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_research_complete: true,
    email_low_credits: true,
    email_product_updates: false,
    email_tips_and_tutorials: false,
    whatsapp_research_complete: false,
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

      {/* WhatsApp Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5 text-green-600" />
            WhatsApp Notifications
          </CardTitle>
          <CardDescription>
            Get instant updates on your phone via WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsappOptions.map((option) => (
            <label
              key={option.key}
              className="flex items-center justify-between p-4 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100"
            >
              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-green-600 mt-0.5" />
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
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </div>
            </label>
          ))}
          <p className="text-xs text-gray-400 mt-2">
            Note: WhatsApp notifications are coming soon. Your preference will be saved.
          </p>
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
