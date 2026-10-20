'use client'

import dynamic from 'next/dynamic'

const AssistantShell = dynamic(
  () => import('@/components/ai/AssistantShell').then((mod) => mod.AssistantShell),
  { ssr: false },
)

export function AssistantMount({ dashboard }: { dashboard: 'portal' | 'admin' | 'editor' }) {
  return <AssistantShell dashboard={dashboard} />
}
