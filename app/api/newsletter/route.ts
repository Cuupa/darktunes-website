/**
 * Legacy newsletter subscription endpoint.
 *
 * Newsletter sign-up is handled via the darkmerch.com Shopify embed
 * (see NewsletterSection). This route returns 410 Gone for any callers
 * still targeting the removed Supabase DOI flow.
 */

import { withErrorHandler, ApiError } from '@/lib/errors'

export const POST = withErrorHandler(async () => {
  throw new ApiError(
    410,
    'Newsletter subscriptions are now handled via darkmerch.com.',
    'NEWSLETTER_MIGRATED',
  )
})