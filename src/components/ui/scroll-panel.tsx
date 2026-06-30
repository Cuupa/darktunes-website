import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const scrollPanelClass =
  'overflow-y-auto overscroll-contain min-h-0'

type ScrollPanelProps = ComponentProps<'div'>

export function ScrollPanel({ className, style, ...props }: ScrollPanelProps) {
  return (
    <div
      data-lenis-prevent
      className={cn(scrollPanelClass, className)}
      style={{ overscrollBehavior: 'contain', ...style }}
      {...props}
    />
  )
}