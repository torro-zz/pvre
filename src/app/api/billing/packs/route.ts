import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: packs, error } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch credit packs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ packs })
  } catch (error) {
    console.error('Packs fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
