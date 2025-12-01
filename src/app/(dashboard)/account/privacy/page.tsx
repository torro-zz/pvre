'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  Clock,
  Check,
  X,
} from 'lucide-react'

interface ExportRequest {
  id: string
  status: string
  download_url: string | null
  created_at: string
  expires_at: string | null
}

interface DeletionRequest {
  id: string
  status: string
  scheduled_deletion_at: string
}

export default function PrivacyPage() {
  const [exportRequests, setExportRequests] = useState<ExportRequest[]>([])
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [exportRes, deleteRes] = await Promise.all([
      fetch('/api/account/export'),
      fetch('/api/account/delete'),
    ])

    if (exportRes.ok) {
      const data = await exportRes.json()
      setExportRequests(data.requests || [])
    }

    if (deleteRes.ok) {
      const data = await deleteRes.json()
      setDeletionRequest(data.request)
    }

    setLoading(false)
  }

  const handleExport = async () => {
    setExporting(true)
    const res = await fetch('/api/account/export', { method: 'POST' })
    if (res.ok) {
      await fetchData()
    }
    setExporting(false)
  }

  const handleDeleteRequest = async () => {
    setDeleting(true)
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: deleteReason }),
    })

    if (res.ok) {
      await fetchData()
      setShowDeleteConfirm(false)
      setDeleteReason('')
    }
    setDeleting(false)
  }

  const handleCancelDeletion = async () => {
    const res = await fetch('/api/account/delete', { method: 'DELETE' })
    if (res.ok) {
      setDeletionRequest(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Privacy & Data</h1>
        <p className="text-gray-500 mt-1">Manage your data and account settings.</p>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data including research results, profile information, and transaction history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? 'Requesting...' : 'Request Data Export'}
          </Button>

          {exportRequests.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Export Requests</h4>
              <div className="space-y-2">
                {exportRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusBadge(req.status)}
                      <span className="text-sm text-gray-600">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {req.status === 'completed' && req.download_url && (
                      <a
                        href={req.download_url}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone after the grace period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deletionRequest ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">Account Deletion Scheduled</p>
                  <p className="text-sm text-red-600 mt-1">
                    Your account is scheduled for deletion on{' '}
                    <strong>
                      {new Date(deletionRequest.scheduled_deletion_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </strong>
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Clock className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      You can cancel this request before the scheduled date.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 border-red-300 text-red-700 hover:bg-red-50"
                    onClick={handleCancelDeletion}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Deletion Request
                  </Button>
                </div>
              </div>
            </div>
          ) : showDeleteConfirm ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Warning: This action cannot be undone</p>
                    <ul className="text-sm text-red-600 mt-2 space-y-1">
                      <li>- All your research data will be permanently deleted</li>
                      <li>- Your purchase history will be erased</li>
                      <li>- Any remaining credits will be forfeited</li>
                      <li>- You will have 7 days to cancel this request</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Reason for leaving (optional)</Label>
                <Input
                  id="reason"
                  placeholder="Help us improve..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleDeleteRequest}
                  disabled={deleting}
                >
                  {deleting ? 'Processing...' : 'Confirm Deletion'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Privacy Policy Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm">
            Learn more about how we collect, use, and protect your data.
          </p>
          <div className="flex gap-4 mt-4">
            <a href="/privacy" className="text-blue-600 hover:underline text-sm">
              Privacy Policy
            </a>
            <a href="/terms" className="text-blue-600 hover:underline text-sm">
              Terms of Service
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
