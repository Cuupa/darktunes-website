import type { Metadata } from 'next'
import { Providers } from './_components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'darkTunes Music Group',
  description:
    'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.',
  openGraph: {
    title: 'darkTunes Music Group',
    description: 'Alternative music label — artists, releases, news, and videos.',
    type: 'website',
  },
}

/**
 * Root Server Component layout — no "use client" here.
 * Providers wraps the tree with client-only concerns (Lenis, Toaster, ErrorBoundary).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&family=Roboto+Slab:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
