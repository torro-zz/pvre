'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  is_active: boolean
  created_at: string
  plainKey?: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    const res = await fetch('/api/account/api-keys')
    if (res.ok) {
      const data = await res.json()
      setKeys(data.keys || [])
    }
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!newKeyName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/account/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewlyCreatedKey(data.key.plainKey)
        setKeys([{ ...data.key, plainKey: undefined }, ...keys])
        setNewKeyName('')
        setShowCreateForm(false)
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    const res = await fetch(`/api/account/api-keys?id=${keyId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setKeys(keys.filter((k) => k.id !== keyId))
    }
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
        <p className="text-muted-foreground mt-1">Manage API keys for programmatic access.</p>
      </div>

      {/* Newly Created Key Warning */}
      {newlyCreatedKey && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  Copy your API key now - it won't be shown again!
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="bg-card px-3 py-2 rounded border border-yellow-300 dark:border-yellow-700 text-sm font-mono flex-1 overflow-x-auto">
                    {newlyCreatedKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-yellow-700 dark:text-yellow-300"
                  onClick={() => setNewlyCreatedKey(null)}
                >
                  I've copied my key
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Key Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Your API Keys
            </span>
            {!showCreateForm && (
              <Button size="sm" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Key
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            API keys allow you to access PVRE programmatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showCreateForm && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-3">Create New API Key</h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="keyName" className="sr-only">Key Name</Label>
                  <Input
                    id="keyName"
                    placeholder="Key name (e.g., 'Production Server')"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No API keys yet.</p>
              <p className="text-sm mt-1">Create a key to get started with the API.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && ` • Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Include your API key in the Authorization header:
          </p>
          <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg text-sm overflow-x-auto">
{`curl -X POST https://pvre.app/api/v1/research \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"hypothesis": "Your hypothesis here"}'`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
