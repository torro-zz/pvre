'use client'

import { useState, useEffect, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FolderDialog } from './folder-dialog'
import {
  Folder,
  FolderPlus,
  Inbox,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'

export interface FolderData {
  id: string
  name: string
  color: string | null
  icon: string | null
  order_index: number | null
  jobCount: number
}

interface FolderListProps {
  isCollapsed?: boolean
}

const FOLDER_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
}

// Wrapper component that provides Suspense boundary
export function FolderList({ isCollapsed = false }: FolderListProps) {
  return (
    <Suspense fallback={
      <div className={cn('px-3 py-2', isCollapsed && 'px-2')}>
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
      </div>
    }>
      <FolderListInner isCollapsed={isCollapsed} />
    </Suspense>
  )
}

function FolderListInner({ isCollapsed = false }: FolderListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentFolderId = searchParams.get('folder')

  const [folders, setFolders] = useState<FolderData[]>([])
  const [unorganizedCount, setUnorganizedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<FolderData | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<FolderData | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/research/folders')
      if (response.ok) {
        const data = await response.json()
        setFolders(data.folders || [])
        setUnorganizedCount(data.unorganizedCount || 0)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFolders()

    // Listen for folder updates from other components (e.g., kebab menu)
    const handleFoldersUpdated = () => fetchFolders()
    window.addEventListener('folders-updated', handleFoldersUpdated)
    return () => window.removeEventListener('folders-updated', handleFoldersUpdated)
  }, [])

  const handleFolderClick = (folderId: string | null) => {
    if (folderId) {
      router.push(`/dashboard?folder=${folderId}`)
    } else {
      router.push('/dashboard')
    }
  }

  const handleCreateFolder = () => {
    setEditingFolder(null)
    setDialogOpen(true)
  }

  const handleEditFolder = (folder: FolderData) => {
    setEditingFolder(folder)
    setDialogOpen(true)
    setMenuOpenId(null)
  }

  const handleDeleteClick = (folder: FolderData) => {
    setDeletingFolder(folder)
    setDeleteError(null)
    setMenuOpenId(null)
  }

  const handleConfirmDelete = async () => {
    if (!deletingFolder) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/research/folders/${deletingFolder.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const wasViewingThisFolder = currentFolderId === deletingFolder.id
        setDeletingFolder(null)
        fetchFolders()
        window.dispatchEvent(new Event('folders-updated'))
        if (wasViewingThisFolder) {
          router.push('/dashboard')
        }
      } else {
        const data = await response.json().catch(() => ({}))
        setDeleteError(data.error || 'Failed to delete folder. Please try again.')
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
      setDeleteError('Network error. Please check your connection and try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => {
    setDeletingFolder(null)
    setDeleteError(null)
  }

  const handleDialogSuccess = (_createdFolder?: { id: string; name: string }) => {
    setDialogOpen(false)
    setEditingFolder(null)
    fetchFolders()
    // Notify other components (e.g., kebab menu folder selector)
    window.dispatchEvent(new Event('folders-updated'))
  }

  if (loading) {
    return (
      <div className={cn('px-3 py-2', isCollapsed && 'px-2')}>
        <div className="h-8 bg-muted/50 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <>
      <div className={cn('px-3 py-2 space-y-1', isCollapsed && 'px-2')}>
        {/* Section Header */}
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Folders
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCreateFolder}
              title="New Folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Unorganized / Inbox */}
        <button
          onClick={() => handleFolderClick(null)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors',
            'hover:bg-muted text-left',
            !currentFolderId && 'bg-primary/10 text-primary font-medium',
            isCollapsed && 'justify-center px-0'
          )}
          title={isCollapsed ? `Inbox (${unorganizedCount})` : undefined}
        >
          <Inbox className="h-4 w-4 flex-shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center justify-between flex-1 min-w-0 overflow-hidden"
              >
                <span className="text-sm truncate">Inbox</span>
                {unorganizedCount > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {unorganizedCount}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Folder List */}
        {folders.map((folder) => (
          <div key={folder.id} className="relative group">
            <button
              onClick={() => handleFolderClick(folder.id)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors',
                'hover:bg-muted text-left',
                currentFolderId === folder.id && 'bg-primary/10 text-primary font-medium',
                isCollapsed && 'justify-center px-0'
              )}
              title={isCollapsed ? `${folder.name} (${folder.jobCount})` : undefined}
            >
              <div className="relative flex-shrink-0">
                <Folder className="h-4 w-4" />
                <div
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full',
                    FOLDER_COLORS[folder.color || 'blue']
                  )}
                />
              </div>
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex items-center justify-between flex-1 min-w-0 overflow-hidden"
                  >
                    <span className="text-sm truncate">{folder.name}</span>
                    {folder.jobCount > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {folder.jobCount}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            {/* Context Menu */}
            {!isCollapsed && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === folder.id ? null : folder.id)
                    }}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>

                  {menuOpenId === folder.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-32 bg-popover rounded-lg shadow-lg border py-1 z-50">
                        <button
                          onClick={() => handleEditFolder(folder)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted w-full"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </button>
                        <button
                          onClick={() => handleDeleteClick(folder)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 w-full"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* New Folder Button (collapsed mode) */}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8"
            onClick={handleCreateFolder}
            title="New Folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <FolderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folder={editingFolder}
        onSuccess={handleDialogSuccess}
      />

      {/* Delete Confirmation Modal */}
      {deletingFolder && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={handleCancelDelete}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl border p-6 z-[201] w-full max-w-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-500/20 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg mb-2">Delete Folder</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {deletingFolder.jobCount > 0 ? (
                    <>
                      Delete "<span className="font-medium text-foreground">{deletingFolder.name}</span>"?{' '}
                      <span className="text-foreground font-medium">{deletingFolder.jobCount}</span> research project{deletingFolder.jobCount !== 1 ? 's' : ''} will move to Inbox.
                    </>
                  ) : (
                    <>
                      Delete "<span className="font-medium text-foreground">{deletingFolder.name}</span>"? This folder is empty.
                    </>
                  )}
                </p>

                {/* Error Message */}
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleCancelDelete}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
