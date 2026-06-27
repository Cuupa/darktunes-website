import { VehicleType, PlanningMode } from './types'

export function isRushHour(departureTime: Date): boolean {
  const hour = departureTime.getHours()
  const dayOfWeek = departureTime.getDay()
  
  if (dayOfWeek === 0 || dayOfWeek === 6) return false
  
  return (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)
}

export function calculateTrafficMultiplier(
  departureTime: Date,
  planningMode: PlanningMode,
  vehicleType: VehicleType
): number {
  let multiplier = 1.0
  
  if (isRushHour(departureTime)) {
    if (planningMode === 'avoid-rush-hour') {
      multiplier = 1.0
    } else {
      multiplier = 1.5
    }
  }
  
  switch (vehicleType) {
    case 'bus':
      multiplier *= 1.15
      break
    case 'truck':
      multiplier *= 1.25
      break
    default:
      break
  }
  
  return multiplier
}

export function suggestDepartureTime(
  baseTime: Date,
  planningMode: PlanningMode
): Date {
  if (planningMode !== 'avoid-rush-hour') {
    return baseTime
  }
  
  const hour = baseTime.getHours()
  const adjusted = new Date(baseTime)
  
  if (hour >= 7 && hour < 9) {
    adjusted.setHours(6, 0, 0)
  } else if (hour >= 16 && hour < 19) {
    adjusted.setHours(14, 30, 0)
  }
  
  return adjusted
}

export function getTrafficWarning(departureTime: Date, planningMode: PlanningMode): string | undefined {
  if (planningMode === 'avoid-rush-hour') {
    return undefined
  }
  
  if (isRushHour(departureTime)) {
    return 'Rush hour traffic expected - consider leaving earlier or later'
  }
  
  return undefined
}

export function adjustDurationForVehicle(baseDuration: number, vehicleType: VehicleType): number {
  switch (vehicleType) {
    case 'bus':
      return Math.round(baseDuration * 1.15)
    case 'truck':
      return Math.round(baseDuration * 1.25)
    default:
      return baseDuration
  }
}
