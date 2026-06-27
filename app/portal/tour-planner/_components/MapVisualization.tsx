import { useEffect, useRef, useState } from 'react'
import type { RouteResult } from '@/lib/tour-planner/types'
import type { TrackStop } from '@/lib/tour-planner/mappers'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MagnifyingGlassPlus, MagnifyingGlassMinus } from '@phosphor-icons/react'

export interface MapLegendLabels {
  title: string
  reset: string
  start: string
  hotel: string
  venue: string
  travel: string
}

interface MapVisualizationProps {
  stops: TrackStop[]
  route: RouteResult | null
  labels: MapLegendLabels
  onMapImageReady?: (imageData: string) => void
}

export function MapVisualization({ stops, route, labels, onMapImageReady }: MapVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!canvasRef.current || stops.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    const validStops = stops.filter(s => s.venueCoords || s.hotelCoords)
    if (validStops.length === 0) return

    const allCoords = validStops.flatMap(s => 
      [s.venueCoords, s.hotelCoords].filter(c => c !== undefined)
    )

    const lats = allCoords.map(c => c!.lat)
    const lons = allCoords.map(c => c!.lon)
    
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    
    const padding = 0.1
    const latRange = maxLat - minLat
    const lonRange = maxLon - minLon
    
    const mapMinLat = minLat - latRange * padding
    const mapMaxLat = maxLat + latRange * padding
    const mapMinLon = minLon - lonRange * padding
    const mapMaxLon = maxLon + lonRange * padding

    const toX = (lon: number) => {
      const normalized = (lon - mapMinLon) / (mapMaxLon - mapMinLon)
      return (normalized * rect.width + pan.x) * zoom
    }

    const toY = (lat: number) => {
      const normalized = 1 - (lat - mapMinLat) / (mapMaxLat - mapMinLat)
      return (normalized * rect.height + pan.y) * zoom
    }

    ctx.clearRect(0, 0, rect.width, rect.height)
    
    ctx.fillStyle = '#f0f4f8'
    ctx.fillRect(0, 0, rect.width, rect.height)
    
    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1
    for (let i = 0; i < 10; i++) {
      const x = (i / 10) * rect.width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, rect.height)
      ctx.stroke()
      
      const y = (i / 10) * rect.height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(rect.width, y)
      ctx.stroke()
    }

    if (route && route.segments.length > 0) {
      route.segments.forEach((segment) => {
        if (segment.fromCoords && segment.toCoords) {
          ctx.beginPath()
          ctx.moveTo(toX(segment.fromCoords.lon), toY(segment.fromCoords.lat))
          ctx.lineTo(toX(segment.toCoords.lon), toY(segment.toCoords.lat))
          
          switch (segment.type) {
            case 'start':
              ctx.strokeStyle = 'oklch(0.55 0.15 150)'
              break
            case 'to-hotel':
              ctx.strokeStyle = 'oklch(0.65 0.15 195)'
              break
            case 'to-venue':
              ctx.strokeStyle = 'oklch(0.60 0.20 330)'
              break
            case 'to-next-hotel':
              ctx.strokeStyle = 'oklch(0.50 0.05 240)'
              break
            default:
              ctx.strokeStyle = '#999999'
          }
          
          ctx.lineWidth = 3
          ctx.stroke()
          
          const midX = (toX(segment.fromCoords.lon) + toX(segment.toCoords.lon)) / 2
          const midY = (toY(segment.fromCoords.lat) + toY(segment.toCoords.lat)) / 2
          const angle = Math.atan2(
            toY(segment.toCoords.lat) - toY(segment.fromCoords.lat),
            toX(segment.toCoords.lon) - toX(segment.fromCoords.lon)
          )
          
          ctx.save()
          ctx.translate(midX, midY)
          ctx.rotate(angle)
          ctx.beginPath()
          ctx.moveTo(-8, -5)
          ctx.lineTo(0, 0)
          ctx.lineTo(-8, 5)
          ctx.stroke()
          ctx.restore()
        }
      })
    }

    stops.forEach((stop, index) => {
      if (stop.hotelCoords) {
        const x = toX(stop.hotelCoords.lon)
        const y = toY(stop.hotelCoords.lat)
        
        ctx.fillStyle = 'oklch(0.65 0.15 195)'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        ctx.fillStyle = '#1a1a1a'
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(stop.hotelName.substring(0, 15), x, y + 20)
      }
      
      if (stop.venueCoords && !stop.isTravelDay) {
        const x = toX(stop.venueCoords.lon)
        const y = toY(stop.venueCoords.lat)
        
        ctx.fillStyle = 'oklch(0.60 0.20 330)'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText((index + 1).toString(), x, y + 4)
      }
    })

    if (onMapImageReady) {
      onMapImageReady(canvas.toDataURL())
    }
  }, [stops, route, zoom, pan, onMapImageReady])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoomIn = () => {
    setZoom(z => Math.min(z * 1.2, 5))
  }

  const handleZoomOut = () => {
    setZoom(z => Math.max(z / 1.2, 0.5))
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{labels.title}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <MagnifyingGlassPlus size={16} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <MagnifyingGlassMinus size={16} />
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            {labels.reset}
          </Button>
        </div>
      </div>
      
      <div className="relative w-full h-[500px] rounded-lg overflow-hidden border-2 border-border bg-muted">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
      
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'oklch(0.55 0.15 150)' }} />
          <span>{labels.start}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'oklch(0.65 0.15 195)' }} />
          <span>{labels.hotel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'oklch(0.60 0.20 330)' }} />
          <span>{labels.venue}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'oklch(0.50 0.05 240)' }} />
          <span>{labels.travel}</span>
        </div>
      </div>
    </Card>
  )
}
