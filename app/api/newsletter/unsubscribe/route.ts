/**
 * Legacy one-click unsubscribe endpoint.
 *
 * Newsletter management moved to Shopify. Old unsubscribe links redirect
 * to the darkmerch.com newsletter page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'

const SHOPIFY_NEWSLETTER_URL = 'https://darkmerch.com/pages/newsletter'

export const GET = withErrorHandler(async (_req: NextRequest): Promise<NextResponse> => {
  return NextResponse.redirect(SHOPIFY_NEWSLETTER_URL)
})