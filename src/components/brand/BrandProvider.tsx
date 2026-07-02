'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { BrandContext } from '@/lib/brand'

const BrandUiContext = createContext<BrandContext | null>(null)

export type BrandProviderProps = {
  brand: BrandContext
  children: ReactNode
}

export function BrandProvider({ brand, children }: BrandProviderProps) {
  return <BrandUiContext.Provider value={brand}>{children}</BrandUiContext.Provider>
}

export function useBrand(): BrandContext {
  const brand = useContext(BrandUiContext)
  if (!brand) {
    throw new Error('useBrand must be used within BrandProvider')
  }
  return brand
}

export function useBrandOptional(): BrandContext | null {
  return useContext(BrandUiContext)
}