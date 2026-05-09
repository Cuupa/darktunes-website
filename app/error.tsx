'use client'

/**
 * app/error.tsx — Next.js error boundary for route segments.
 *
 * Catches rendering errors in the page tree below the root layout.
 * Shows a user-friendly message with a retry button.
 */

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Warning } from '@phosphor-icons/react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full border-destructive/40">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <Warning size={48} weight="fill" className="text-destructive" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground text-sm">
            {process.env.NODE_ENV === 'development'
              ? error.message
              : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
          </p>
          <Button onClick={reset} variant="default">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
