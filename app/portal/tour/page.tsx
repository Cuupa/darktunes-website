/**
 * app/portal/tour/page.tsx — Redirect to /portal/events
 *
 * Legacy URL only. Live shows are managed under /portal/events (EventManager).
 * Tour Production lives at /portal/tour-planner and is unchanged.
 */
import { redirect } from 'next/navigation'

export default function TourPage() {
  redirect('/portal/events')
}

