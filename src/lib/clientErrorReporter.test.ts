import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  reportClientError,
  shouldReportWindowError,
  _resetClientErrorReporterForTests,
} from './clientErrorReporter'

describe('shouldReportWindowError', () => {
  const origin = 'https://www.darktunes.com'

  it('ignores ResizeObserver noise and errors from other origins', () => {
    expect(shouldReportWindowError({
      filename: `${origin}/_next/static/chunks/app.js`,
      message: 'ResizeObserver loop completed with undelivered notifications.',
    }, origin)).toBe(false)
    expect(shouldReportWindowError({
      filename: 'chrome-extension://abc/inject.js',
      message: 'extension blew up',
    }, origin)).toBe(false)
    expect(shouldReportWindowError({ message: 'Script error.' }, origin)).toBe(false)
  })

  it('reports a crash from this site', () => {
    expect(shouldReportWindowError({
      filename: `${origin}/_next/static/chunks/app.js`,
      message: 'Cannot read properties of undefined',
    }, origin)).toBe(true)
  })
})

describe('reportClientError', () => {
  const sendBeacon = vi.fn().mockReturnValue(true)
  const fetchMock = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    _resetClientErrorReporterForTests()
    sendBeacon.mockClear().mockReturnValue(true)
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(globalThis.navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
    })
  })

  afterEach(() => {
    _resetClientErrorReporterForTests()
  })

  it('sends immediately via sendBeacon', () => {
    reportClientError('ui', new Error('boom'), { boundary: 'app/error.tsx' })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob]
    expect(url).toBe('/api/log-error')
    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to keepalive fetch when sendBeacon is unavailable', () => {
    Object.defineProperty(globalThis.navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
    })

    reportClientError('ui', new Error('boom'))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/log-error',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        credentials: 'include',
      }),
    )
  })

  it('caps reports per minute', () => {
    for (let i = 0; i < 8; i += 1) {
      reportClientError('ui', new Error(`boom-${i}`))
    }
    expect(sendBeacon).toHaveBeenCalledTimes(5)
  })
})
