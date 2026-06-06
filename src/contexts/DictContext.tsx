'use client'

/**
 * src/contexts/DictContext.tsx
 *
 * Provides the active locale's full dictionary to all client components
 * within the admin layout tree without requiring prop drilling.
 *
 * Server Component usage (e.g. app/admin/layout.tsx):
 *   const dict = await getDictionary()
 *   return <AdminClientLayout dict={dict}>...</AdminClientLayout>
 *
 * Client Component usage:
 *   const dict = useDict()
 *   toast.error(dict.errors.SERVER_ERROR)
 */

import { createContext, useContext } from 'react'
import type { Dictionary } from '@/i18n/types'

export const DictContext = createContext<Dictionary | null>(null)

/**
 * Returns the active dictionary. Throws if called outside a DictContext.Provider.
 */
export function useDict(): Dictionary {
  const dict = useContext(DictContext)
  if (!dict) {
    throw new Error('useDict must be used within a DictContext.Provider')
  }
  return dict
}
