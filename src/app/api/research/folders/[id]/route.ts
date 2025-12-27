import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Available folder colors
const FOLDER_COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'pink'] as const

// PATCH /api/research/folders/[id] - Update a folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify folder belongs to user
    const { data: existingFolder, error: fetchError } = await supabase
      .from('research_folders')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    // Validate and add name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Folder name cannot be empty' }, { status: 400 })
      }
      const trimmedName = body.name.trim()
      if (trimmedName.length > 50) {
        return NextResponse.json({ error: 'Folder name must be 50 characters or less' }, { status: 400 })
      }
      updates.name = trimmedName
    }

    // Validate and add color if provided
    if (body.color !== undefined) {
      if (FOLDER_COLORS.includes(body.color)) {
        updates.color = body.color
      }
    }

    // Add icon if provided
    if (body.icon !== undefined) {
      updates.icon = body.icon
    }

    // Add order_index if provided
    if (body.order_index !== undefined && typeof body.order_index === 'number') {
      updates.order_index = body.order_index
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const { data: folder, error } = await supabase
      .from('research_folders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 })
      }
      console.error('Error updating folder:', error)
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
    }

    return NextResponse.json({ folder })
  } catch (error) {
    console.error('Error in PATCH /api/research/folders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/research/folders/[id] - Delete a folder
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify folder belongs to user
    const { data: existingFolder, error: fetchError } = await supabase
      .from('research_folders')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingFolder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Jobs in this folder will have folder_id set to NULL due to ON DELETE SET NULL
    const { error } = await supabase
      .from('research_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting folder:', error)
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/research/folders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
