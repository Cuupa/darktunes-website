import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAllVideoSubmissions } from '@/lib/api/videoSubmissions'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const supabase = await createServerSupabaseClient()
  const submissions = await getAllVideoSubmissions(supabase)
  return NextResponse.json(submissions)
})
