'use client'

/**
 * src/lib/epk/EPKThemeContext.tsx
 *
 * React context that supplies the active EPKTheme to all children of
 * EPKDocument. Wrap any EPK rendering tree with <EPKThemeProvider> and
 * consume the active theme via useEPKTheme().
 */

import { createContext, useContext, useMemo } from 'react'
import { getEPKTheme, buildCustomTheme, DEFAULT_THEME_ID } from './themes'
import type { EPKTheme } from './themes'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const EPKThemeContext = createContext<EPKTheme>(getEPKTheme(DEFAULT_THEME_ID))

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface EPKThemeProviderProps {
  themeId?: string
  /** Custom color tokens — only used when themeId === 'custom'. */
  customTokens?: Record<string, string>
  children: React.ReactNode
}

export function EPKThemeProvider({ themeId, customTokens, children }: EPKThemeProviderProps) {
  const theme = useMemo(() => {
    if (themeId === 'custom') return buildCustomTheme(customTokens ?? {})
    return getEPKTheme(themeId)
  }, [themeId, customTokens])
  return <EPKThemeContext.Provider value={theme}>{children}</EPKThemeContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEPKTheme(): EPKTheme {
  return useContext(EPKThemeContext)
}
