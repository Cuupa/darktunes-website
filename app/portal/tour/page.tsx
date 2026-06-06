/**
 * app/portal/tour/page.tsx — Redirect to /portal/events
 *
 * Kept for backwards compatibility. The section was renamed from "Tour" to "Events".
 */
import { redirect } from 'next/navigation'

export default function TourPage() {
  redirect('/portal/events')
}

