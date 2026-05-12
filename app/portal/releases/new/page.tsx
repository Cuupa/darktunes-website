export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ReleaseSubmissionForm } from './_components/ReleaseSubmissionForm'

export default async function NewReleasePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <ReleaseSubmissionForm dict={dict.portal} />
}
