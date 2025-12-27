import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/supabase'

type FolderRow = Database['public']['Tables']['research_folders']['Row']
type FolderInsert = Database['public']['Tables']['research_folders']['Insert']

// Available folder colors
const FOLDER_COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'pink'] as const

// GET /api/research/folders - List user's folders with job counts
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch folders ordered by order_index
    const { data: folders, error: foldersError } = await supabase
      .from('research_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (foldersError) {
      console.error('Error fetching folders:', foldersError)
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    // Get job counts per folder
    const { data: jobCounts, error: countError } = await supabase
      .from('research_jobs')
      .select('folder_id')
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error fetching job counts:', countError)
      return NextResponse.json({ error: 'Failed to fetch job counts' }, { status: 500 })
    }

    // Count jobs per folder
    const folderJobCounts: Record<string, number> = {}
    let unorganizedCount = 0

    for (const job of jobCounts || []) {
      if (job.folder_id) {
        folderJobCounts[job.folder_id] = (folderJobCounts[job.folder_id] || 0) + 1
      } else {
        unorganizedCount++
      }
    }

    // Add job counts to folders
    const foldersWithCounts = (folders || []).map(folder => ({
      ...folder,
      jobCount: folderJobCounts[folder.id] || 0,
    }))

    return NextResponse.json({
      folders: foldersWithCounts,
      unorganizedCount,
    })
  } catch (error) {
    console.error('Error in GET /api/research/folders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/research/folders - Create a new folder
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color = 'blue', icon = 'folder' } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (trimmedName.length > 50) {
      return NextResponse.json({ error: 'Folder name must be 50 characters or less' }, { status: 400 })
    }

    // Validate color
    const validColor = FOLDER_COLORS.includes(color) ? color : 'blue'

    // Get the next order_index
    const { data: existingFolders } = await supabase
      .from('research_folders')
      .select('order_index')
      .eq('user_id', user.id)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrderIndex = existingFolders?.[0]?.order_index
      ? (existingFolders[0].order_index + 1)
      : 0

    // Create the folder
    const folderData: FolderInsert = {
      user_id: user.id,
      name: trimmedName,
      color: validColor,
      icon,
      order_index: nextOrderIndex,
    }

    const { data: folder, error } = await supabase
      .from('research_folders')
      .insert(folderData)
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 })
      }
      console.error('Error creating folder:', error)
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
    }

    return NextResponse.json({ folder }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/research/folders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
