import type { APIProvider, RouteResult, RouteSegment, VehicleType, PlanningMode } from './types'
import type { TrackStop } from './mappers'
import { calculateDistance } from './geocoding'
import { adjustDurationForVehicle, getTrafficWarning } from './traffic'

export async function calculateTourRoute(
  stops: TrackStop[],
  startLocation: { name: string; address: string; city: string; country: string },
  provider: APIProvider,
  apiKey?: string,
  vehicleType: VehicleType = 'car',
  planningMode: PlanningMode = 'fastest'
): Promise<RouteResult> {
  const segments: RouteSegment[] = []
  let totalDistance = 0
  let totalDuration = 0

  if (stops.length === 0) {
    return { segments: [], totalDistance: 0, totalDuration: 0, error: 'No stops provided' }
  }

  for (const stop of stops) {
    if (!stop.venueCoords || !stop.hotelCoords) {
      return {
        segments: [],
        totalDistance: 0,
        totalDuration: 0,
        error: `Missing coordinates for stop: ${stop.venueName}`
      }
    }
  }

  let currentTime = new Date()

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    const prevStop = i > 0 ? stops[i - 1] : null

    if (i === 0) {
      const hotelResult = await calculateDistance(
        stop.hotelCoords!,
        stop.venueCoords!,
        provider,
        apiKey
      )

      if ('error' in hotelResult) {
        return {
          segments: [],
          totalDistance: 0,
          totalDuration: 0,
          error: hotelResult.error
        }
      }

      const adjustedDuration = adjustDurationForVehicle(hotelResult.duration, vehicleType)
      const trafficWarning = getTrafficWarning(currentTime, planningMode)

      segments.push({
        from: `${stop.hotelName}, ${stop.hotelCity}`,
        to: `${stop.venueName}, ${stop.venueCity}`,
        fromCoords: stop.hotelCoords!,
        toCoords: stop.venueCoords!,
        distance: hotelResult.distance,
        duration: adjustedDuration,
        type: 'start',
        departureTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        trafficWarning
      })

      totalDistance += hotelResult.distance
      totalDuration += adjustedDuration
      currentTime = new Date(currentTime.getTime() + adjustedDuration * 60000)

      const returnResult = await calculateDistance(
        stop.venueCoords!,
        stop.hotelCoords!,
        provider,
        apiKey
      )

      if ('error' in returnResult) {
        return {
          segments: [],
          totalDistance: 0,
          totalDuration: 0,
          error: returnResult.error
        }
      }

      const returnDuration = adjustDurationForVehicle(returnResult.duration, vehicleType)
      currentTime = new Date(currentTime.getTime() + 3 * 60 * 60000)
      const returnTraffic = getTrafficWarning(currentTime, planningMode)

      segments.push({
        from: `${stop.venueName}, ${stop.venueCity}`,
        to: `${stop.hotelName}, ${stop.hotelCity}`,
        fromCoords: stop.venueCoords!,
        toCoords: stop.hotelCoords!,
        distance: returnResult.distance,
        duration: returnDuration,
        type: 'to-hotel',
        departureTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        trafficWarning: returnTraffic
      })

      totalDistance += returnResult.distance
      totalDuration += returnDuration
      currentTime = new Date(currentTime.getTime() + returnDuration * 60000)
    } else {
      currentTime = new Date(currentTime.getTime() + 12 * 60 * 60000)
      
      const travelResult = await calculateDistance(
        prevStop!.hotelCoords!,
        stop.hotelCoords!,
        provider,
        apiKey
      )

      if ('error' in travelResult) {
        return {
          segments: [],
          totalDistance: 0,
          totalDuration: 0,
          error: travelResult.error
        }
      }

      const travelDuration = adjustDurationForVehicle(travelResult.duration, vehicleType)
      const travelTraffic = getTrafficWarning(currentTime, planningMode)

      segments.push({
        from: `${prevStop!.hotelName}, ${prevStop!.hotelCity}`,
        to: `${stop.hotelName}, ${stop.hotelCity}`,
        fromCoords: prevStop!.hotelCoords!,
        toCoords: stop.hotelCoords!,
        distance: travelResult.distance,
        duration: travelDuration,
        type: 'to-next-hotel',
        departureTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        trafficWarning: travelTraffic
      })

      totalDistance += travelResult.distance
      totalDuration += travelDuration
      currentTime = new Date(currentTime.getTime() + travelDuration * 60000)

      const venueResult = await calculateDistance(
        stop.hotelCoords!,
        stop.venueCoords!,
        provider,
        apiKey
      )

      if ('error' in venueResult) {
        return {
          segments: [],
          totalDistance: 0,
          totalDuration: 0,
          error: venueResult.error
        }
      }

      const venueDuration = adjustDurationForVehicle(venueResult.duration, vehicleType)
      const venueTraffic = getTrafficWarning(currentTime, planningMode)

      segments.push({
        from: `${stop.hotelName}, ${stop.hotelCity}`,
        to: `${stop.venueName}, ${stop.venueCity}`,
        fromCoords: stop.hotelCoords!,
        toCoords: stop.venueCoords!,
        distance: venueResult.distance,
        duration: venueDuration,
        type: 'to-venue',
        departureTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        trafficWarning: venueTraffic
      })

      totalDistance += venueResult.distance
      totalDuration += venueDuration
      currentTime = new Date(currentTime.getTime() + venueDuration * 60000)

      const returnResult = await calculateDistance(
        stop.venueCoords!,
        stop.hotelCoords!,
        provider,
        apiKey
      )

      if ('error' in returnResult) {
        return {
          segments: [],
          totalDistance: 0,
          totalDuration: 0,
          error: returnResult.error
        }
      }

      const returnDuration = adjustDurationForVehicle(returnResult.duration, vehicleType)
      currentTime = new Date(currentTime.getTime() + 3 * 60 * 60000)
      const returnTraffic = getTrafficWarning(currentTime, planningMode)

      segments.push({
        from: `${stop.venueName}, ${stop.venueCity}`,
        to: `${stop.hotelName}, ${stop.hotelCity}`,
        fromCoords: stop.venueCoords!,
        toCoords: stop.hotelCoords!,
        distance: returnResult.distance,
        duration: returnDuration,
        type: 'to-hotel',
        departureTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        trafficWarning: returnTraffic
      })

      totalDistance += returnResult.distance
      totalDuration += returnDuration
      currentTime = new Date(currentTime.getTime() + returnDuration * 60000)
    }
  }

  return {
    segments,
    totalDistance,
    totalDuration
  }
}
