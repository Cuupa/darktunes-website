import { useMemo } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import {
  cmsAudienceFromRole,
  getCmsArtistEditPath,
  getCmsArtistsPath,
  getCmsHomePath,
  getCmsNewsEditPath,
  getCmsNewsListPath,
  getCmsNewsNewPath,
  getCmsPromoLogPath,
  getCmsTabPath,
} from '@/lib/editor/cmsPaths'

export function useCmsPaths() {
  const { profile, loading } = useAuthContext()
  const audience = loading ? 'admin' : cmsAudienceFromRole(profile?.role)

  return useMemo(
    () => ({
      audience,
      isEditor: audience === 'editor',
      home: getCmsHomePath(audience),
      tab: (tab: string) => getCmsTabPath(audience, tab),
      artists: getCmsArtistsPath(audience),
      newsList: getCmsNewsListPath(audience),
      newsNew: getCmsNewsNewPath(),
      newsEdit: getCmsNewsEditPath,
      artistEdit: getCmsArtistEditPath,
      promoLog: getCmsPromoLogPath(audience),
    }),
    [audience],
  )
}