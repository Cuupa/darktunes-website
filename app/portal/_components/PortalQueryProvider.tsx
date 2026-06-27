'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

interface PortalQueryProviderProps {
  children: ReactNode
}

const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => (await get(key)) ?? null,
    setItem: async (key, value) => { await set(key, value) },
    removeItem: async (key) => { await del(key) },
  },
  key: 'dt-portal-query-cache',
})

export function PortalQueryProvider({ children }: PortalQueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            gcTime: 1000 * 60 * 60 * 24 * 7,
          },
        },
      }),
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key = query.queryKey[0]
            return key === 'tour-planner'
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}