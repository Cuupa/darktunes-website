'use client'

const SPACER_HEIGHT: Record<string, string> = {
  sm: 'h-8',
  md: 'h-16',
  lg: 'h-32',
}

interface SpacerBlockProps {
  size?: string
}

export function SpacerBlock({ size = 'md' }: SpacerBlockProps) {
  return <div className={SPACER_HEIGHT[size] ?? SPACER_HEIGHT.md} aria-hidden />
}