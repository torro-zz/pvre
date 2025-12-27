'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Folder, Inbox, Check, ChevronRight } from 'lucide-react'
import type { FolderData } from './folder-list'

interface FolderSelectorProps {
  currentFolderId?: string | null
  onSelect: (folderId: string | null) => void
  onClose: () => void
}

const FOLDER_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
}

export function FolderSelector({ currentFolderId, onSelect, onClose }: FolderSelectorProps) {
  const [folders, setFolders] = useState<FolderData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const response = await fetch('/api/research/folders')
        if (response.ok) {
          const data = await response.json()
          setFolders(data.folders || [])
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFolders()

    // Listen for folder updates (e.g., when new folder is created)
    const handleFoldersUpdated = () => {
      setLoading(true)
      fetchFolders()
    }
    window.addEventListener('folders-updated', handleFoldersUpdated)
    return () => window.removeEventListener('folders-updated', handleFoldersUpdated)
  }, [])

  if (loading) {
    return (
      <div className="py-2 px-3 text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="py-1">
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Move to
      </div>

      {/* Inbox / Unorganized */}
      <button
        onClick={() => {
          onSelect(null)
          onClose()
        }}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted',
          !currentFolderId && 'text-primary font-medium'
        )}
      >
        <Inbox className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">Inbox</span>
        {!currentFolderId && <Check className="h-4 w-4" />}
      </button>

      {/* Folders */}
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => {
            onSelect(folder.id)
            onClose()
          }}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted',
            currentFolderId === folder.id && 'text-primary font-medium'
          )}
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
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {currentFolderId === folder.id && <Check className="h-4 w-4" />}
        </button>
      ))}

      {folders.length === 0 && (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          No folders yet
        </div>
      )}
    </div>
  )
}

// Submenu trigger for the kebab menu
export function FolderMenuTrigger({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted w-full"
    >
      <Folder className="h-4 w-4" />
      <span className="flex-1 text-left">Move to Folder</span>
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}
