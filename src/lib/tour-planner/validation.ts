import { z } from 'zod'
import type { ShowStatus } from '@/lib/tour-planner/types'

export const SHOW_STATUS_VALUES = [
  'option',
  'confirmed',
  'contract-sent',
  'deposit-paid',
  'cancelled',
] as const satisfies readonly ShowStatus[]

export const showStatusSchema = z.enum(SHOW_STATUS_VALUES)