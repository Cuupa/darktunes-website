'use client'

import { FileExplorer } from './file-explorer/FileExplorer'

interface AssetsManagerProps {
  variant?: 'fill' | 'embedded'
}

export function AssetsManager({ variant = 'fill' }: AssetsManagerProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <FileExplorer variant={variant} />
    </div>
  )
}
