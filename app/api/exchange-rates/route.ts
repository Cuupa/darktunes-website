/**
 * app/api/exchange-rates/route.ts
 *
 * Server-side proxy for the Frankfurter open-source ECB exchange-rate API.
 * Avoids the CORS restriction imposed on direct browser requests to api.frankfurter.app.
 *
 * GET /api/exchange-rates
 *   → Proxies https://api.frankfurter.app/latest?from=EUR
 *   → Returns { base: "EUR", rates: { USD: 1.08, … } }
 *
 * GET /api/exchange-rates?start=YYYY-MM&end=YYYY-MM
 *   → Proxies time-series and aggregates daily rates into monthly averages
 *   → Returns { base: "EUR", rates: { "YYYY-MM": { USD: 1.08, … }, … } }
 */

import { NextResponse } from 'next/server'

const FRANKFURTER_BASE = 'https://api.frankfurter.app'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  try {
    if (start && end) {
      // Historical time-series: aggregate daily rates into monthly averages.
      // Frankfurter returns one rate per trading day; we group by YYYY-MM and
      // compute the mean of all daily rates within each calendar month.
      const [startYear, startMonth] = start.split('-').map(Number)
      const [endYear, endMonth] = end.split('-').map(Number)

      // Expand "YYYY-MM" to first/last day of the month range for Frankfurter.
      const fromDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`
      const lastDay = new Date(endYear, endMonth, 0).getDate()
      const toDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${lastDay}`

      const upstreamRes = await fetch(
        `${FRANKFURTER_BASE}/${fromDate}..${toDate}?from=EUR`,
        { next: { revalidate: 3600 } },
      )

      if (!upstreamRes.ok) {
        return NextResponse.json(
          { error: `Frankfurter API error: ${upstreamRes.status}` },
          { status: upstreamRes.status },
        )
      }

      const data = await upstreamRes.json() as {
        base: string
        start_date: string
        end_date: string
        rates: Record<string, Record<string, number>>
      }

      // Aggregate: group daily rates by "YYYY-MM", compute per-currency mean.
      const monthly: Record<string, Record<string, number>> = {}
      for (const [date, dayRates] of Object.entries(data.rates)) {
        const monthKey = date.slice(0, 7) // "YYYY-MM"
        if (!monthly[monthKey]) monthly[monthKey] = {}
        for (const [currency, rate] of Object.entries(dayRates)) {
          if (!monthly[monthKey][currency]) {
            monthly[monthKey][currency] = 0
          }
          monthly[monthKey][currency] += rate
        }
      }

      // Compute counts and divide totals to get averages.
      const counts: Record<string, number> = {}
      for (const date of Object.keys(data.rates)) {
        const monthKey = date.slice(0, 7)
        counts[monthKey] = (counts[monthKey] ?? 0) + 1
      }
      for (const [monthKey, currencies] of Object.entries(monthly)) {
        const n = counts[monthKey] ?? 1
        for (const currency of Object.keys(currencies)) {
          monthly[monthKey][currency] = monthly[monthKey][currency] / n
        }
      }

      return NextResponse.json({ base: data.base, rates: monthly })
    }

    // Current rates (no date range).
    const upstreamRes = await fetch(`${FRANKFURTER_BASE}/latest?from=EUR`, {
      next: { revalidate: 3600 },
    })

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Frankfurter API error: ${upstreamRes.status}` },
        { status: upstreamRes.status },
      )
    }

    const data = await upstreamRes.json() as {
      base: string
      date: string
      rates: Record<string, number>
    }

    return NextResponse.json({ base: data.base, rates: data.rates })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Exchange rate fetch failed' },
      { status: 502 },
    )
  }
}
