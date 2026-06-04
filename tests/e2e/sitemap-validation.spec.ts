import { test, expect } from '@playwright/test'

const SITEMAP_LIMIT = 50

function extractSitemapUrls(xml: string): string[] {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
  return matches.map((match) => match[1]).filter((url): url is string => Boolean(url))
}

test('sitemap URLs return HTTP 200 (first 50)', async ({ request, baseURL }) => {
  const response = await request.get('/sitemap.xml')
  expect(response.status()).toBe(200)

  const xml = await response.text()
  const urls = extractSitemapUrls(xml).slice(0, SITEMAP_LIMIT)
  expect(urls.length).toBeGreaterThan(0)

  const origin = new URL(baseURL ?? 'http://localhost:3000').origin

  for (const absoluteUrl of urls) {
    const url = new URL(absoluteUrl, origin)
    const route = `${url.pathname}${url.search}`
    const routeResponse = await request.get(route)
    expect(routeResponse.status(), `Sitemap route must return 200: ${route}`).toBe(200)
  }
})
