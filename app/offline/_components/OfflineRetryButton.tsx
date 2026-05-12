'use client'

/**
 * Client Component wrapper for the "Try Again" button on the offline page.
 * Extracted from the Server Component page so that the onClick handler compiles.
 */
export function OfflineRetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-mono text-sm uppercase tracking-widest hover:bg-accent/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      Try Again
    </button>
  )
}
