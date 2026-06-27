import type { TrackStop as TourStop } from './mappers'

function detectDelimiter(line: string): string {
  const delimiters = [';', ',', '\t', '|']
  const counts = delimiters.map(d => ({
    delimiter: d,
    count: line.split(d).length
  }))
  
  const sorted = counts.sort((a, b) => b.count - a.count)
  return sorted[0].count > 1 ? sorted[0].delimiter : ';'
}

function parseDateString(dateStr: string): string {
  if (!dateStr || dateStr === '0') return new Date().toISOString().split('T')[0]
  
  dateStr = dateStr.trim()
  
  const formats = [
    /^(\d{2})\.(\d{2})\.(\d{4})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ]
  
  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      if (format === formats[0] || format === formats[2] || format === formats[3]) {
        const [, day, month, year] = match
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      } else {
        const [, year, month, day] = match
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }
  }
  
  return new Date().toISOString().split('T')[0]
}

function combineAddressParts(street?: string, plzOrt?: string): { address: string; city: string; postalCode?: string } {
  if (!street && !plzOrt) return { address: '', city: '' }
  
  const address = street || ''
  let city = ''
  let postalCode = ''
  
  if (plzOrt) {
    const plzMatch = plzOrt.match(/^(\d{5})\s+(.+)$/)
    if (plzMatch) {
      postalCode = plzMatch[1]
      city = plzMatch[2]
    } else {
      city = plzOrt
    }
  }
  
  return { address, city, postalCode }
}

export function parseCSVText(text: string): TourStop[] {
  const lines = text.split('\n').filter(line => line.trim())
  
  if (lines.length < 2) {
    throw new Error('File must contain at least a header row and one data row')
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase())
  const stops: TourStop[] = []

  const findColumn = (patterns: string[]): number => {
    return headers.findIndex(h => 
      patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
    )
  }

  const dateCol = findColumn(['date', 'datum'])
  const locationCol = findColumn(['ort', 'location', 'city', 'stadt'])
  
  const venueNameCol = findColumn(['venue name', 'venue', 'veranstaltungsort', 'location name'])
  const venueStreetCol = findColumn(['venue straße', 'venue street', 'venue strasse', 'venue address'])
  const venuePlzOrtCol = findColumn(['venue plz', 'venue postal', 'venue city'])
  const venueAddressCol = findColumn(['venue address', 'venue addr', 'adresse veranstaltungsort'])
  const venueCityCol = findColumn(['venue city', 'venue stadt'])
  const venueCountryCol = findColumn(['venue country', 'venue land', 'country', 'land'])
  
  const hotelNameCol = findColumn(['hotel name', 'hotel', 'unterkunft'])
  const hotelStreetCol = findColumn(['hotel straße', 'hotel street', 'hotel strasse'])
  const hotelPlzOrtCol = findColumn(['hotel plz', 'hotel postal'])
  const hotelAddressCol = findColumn(['hotel address', 'hotel addr', 'hotel adresse'])
  const hotelCityCol = findColumn(['hotel city', 'hotel stadt'])
  const hotelCountryCol = findColumn(['hotel country', 'hotel land'])

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim())
    
    if (values.length < 2) continue

    const rawDate = dateCol >= 0 ? values[dateCol] : ''
    const parsedDate = parseDateString(rawDate)
    
    let venueAddress = venueAddressCol >= 0 ? values[venueAddressCol] || '' : ''
    let venueCity = venueCityCol >= 0 ? values[venueCityCol] || '' : ''
    
    if (venueStreetCol >= 0 && venuePlzOrtCol >= 0) {
      const combined = combineAddressParts(values[venueStreetCol], values[venuePlzOrtCol])
      venueAddress = combined.address || venueAddress
      venueCity = combined.city || venueCity
    }
    
    let hotelAddress = hotelAddressCol >= 0 ? values[hotelAddressCol] || '' : ''
    let hotelCity = hotelCityCol >= 0 ? values[hotelCityCol] || '' : ''
    
    if (hotelStreetCol >= 0 && hotelPlzOrtCol >= 0) {
      const combined = combineAddressParts(values[hotelStreetCol], values[hotelPlzOrtCol])
      hotelAddress = combined.address || hotelAddress
      hotelCity = combined.city || hotelCity
    }
    
    const defaultLocation = locationCol >= 0 ? values[locationCol] : ''
    if (!venueCity && defaultLocation) venueCity = defaultLocation
    if (!hotelCity && defaultLocation) hotelCity = defaultLocation
    
    const venueName = venueNameCol >= 0 ? values[venueNameCol] || '' : ''
    const hotelName = hotelNameCol >= 0 ? values[hotelNameCol] || '' : ''
    
    const isTravelDay = venueName === '0' || venueName.toLowerCase().includes('travel')

    const stop: TourStop = {
      id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
      date: parsedDate,
      venueName: isTravelDay ? 'Travel Day' : venueName,
      venueAddress: isTravelDay ? '' : venueAddress,
      venueCity: isTravelDay ? '' : venueCity,
      venueCountry: isTravelDay ? '' : (venueCountryCol >= 0 ? values[venueCountryCol] || 'Germany' : 'Germany'),
      hotelName,
      hotelAddress,
      hotelCity,
      hotelCountry: hotelCountryCol >= 0 ? values[hotelCountryCol] || 'Germany' : 'Germany',
      isTravelDay
    }

    stops.push(stop)
  }

  return stops
}

export async function parseCSVFile(file: File): Promise<TourStop[]> {
  return parseCSVText(await file.text())
}

export async function parseExcelFile(file: File): Promise<TourStop[]> {
  return parseCSVFile(file)
}
