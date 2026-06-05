export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { VideoSubmissionForm } from './_components/VideoSubmissionForm'

export default async function NewVideoPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <VideoSubmissionForm dict={dict.portal} />
}
