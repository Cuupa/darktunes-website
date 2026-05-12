import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline – darkTunes Music Group',
}

/**
 * Offline fallback page — served by the service worker when the network is
 * unavailable and the requested document is not in the precache.
 */
export default function OfflinePage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center"
    >
      {/* Subtle glitch-style decoration */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(73,54,135,0.06) 2px, rgba(73,54,135,0.06) 4px)',
        }}
      />

      <div className="relative z-10 max-w-md space-y-6">
        {/* Logo wordmark */}
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-muted-foreground">
          darkTunes Music Group
        </p>

        {/* Signal icon */}
        <div className="flex items-center justify-center" aria-hidden="true">
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-accent opacity-60"
          >
            <path
              d="M8 40 Q32 10 56 40"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M16 46 Q32 22 48 46"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M24 52 Q32 34 40 52"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="32" cy="56" r="3" fill="currentColor" />
            {/* Diagonal cross to indicate no signal */}
            <line x1="6" y1="6" x2="58" y2="58" stroke="#7e1e37" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-foreground">No Signal</h1>

        <p className="text-muted-foreground font-serif leading-relaxed">
          You appear to be offline. Check your connection and try again — the
          music will be waiting for you.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-mono text-sm uppercase tracking-widest hover:bg-accent/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Try Again
        </button>
      </div>
    </main>
  )
}
