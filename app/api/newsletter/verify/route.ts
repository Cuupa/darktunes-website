/**
 * Legacy Double Opt-In verification endpoint.
 *
 * Newsletter sign-up moved to Shopify. Old confirmation links redirect
 * to the public newsletter page so users can subscribe there.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  return NextResponse.redirect(new URL('/newsletter', req.url))
})