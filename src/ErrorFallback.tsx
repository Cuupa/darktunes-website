'use client'

import type { FallbackProps } from 'react-error-boundary'
import { Alert, AlertTitle, AlertDescription } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";

export const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  if (process.env.NODE_ENV === 'development') throw error;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Alert variant="destructive" className="mb-6">
          <Warning size={20} />
          <AlertTitle>An unexpected error occurred</AlertTitle>
          <AlertDescription>
            Something went wrong while running the application. Please try again or contact support if the problem persists.
          </AlertDescription>
        </Alert>

        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Error Details:</h3>
          <pre className="text-xs text-destructive bg-muted/50 p-3 rounded border overflow-auto overscroll-contain max-h-32" data-lenis-prevent>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>

        <Button
          onClick={resetErrorBoundary}
          className="w-full"
          variant="outline"
        >
          <ArrowsClockwise size={16} className="mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
