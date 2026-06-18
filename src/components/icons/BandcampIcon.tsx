/**
 * src/components/icons/BandcampIcon.tsx
 *
 * Custom Bandcamp logo SVG as a React component.
 * Matches the Phosphor Icon API: accepts `size`, `weight`, `className`, and `aria-hidden`.
 * The Bandcamp logo is a stylised flag/speech-bubble shape — their official brand mark.
 */

import type { SVGProps } from 'react'

interface BandcampIconProps extends SVGProps<SVGSVGElement> {
  /** Icon size in pixels. Defaults to 24. */
  size?: number
  /** Ignored — present for API parity with Phosphor icons. */
  weight?: string
}

export function BandcampIcon({ size = 24, weight: _weight, className, style, ...rest }: BandcampIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      role="img"
      {...rest}
    >
      {/* Official Bandcamp logotype: a triangle/chevron flag shape */}
      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5z" />
    </svg>
  )
}
