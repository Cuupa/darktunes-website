/**
 * app/admin/colors/page.tsx — Color Theme & Visual Effects
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminColorsWrapper } from '../_components/AdminColorsWrapper'

export default function AdminColorsPage() {
  return (
    <AdminPageShell
      title="Color Theme"
      description="Customise the site's color palette, visual effects, and gradient tokens."
    >
      <AdminColorsWrapper />
    </AdminPageShell>
  )
}
