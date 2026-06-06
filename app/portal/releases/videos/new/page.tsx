export const dynamic = 'force-dynamic'

import { VideoSubmissionForm } from './_components/VideoSubmissionForm'
import { getPortalDictionary } from '@/i18n/getDictionary'

export default async function NewVideoPage() {
  const dict = await getPortalDictionary()

  return <VideoSubmissionForm dict={dict.portal} />
}
