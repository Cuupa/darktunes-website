import {
  AI_PROVIDER_ERROR_CODES,
  type AiProviderErrorCode,
} from '@/lib/ai/types/provider'

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode
  readonly httpStatus: number | null
  readonly retryAfterMs: number | null
  readonly retryable: boolean

  constructor(
    code: AiProviderErrorCode,
    message: string,
    options?: { httpStatus?: number | null; retryAfterMs?: number | null; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AiProviderError'
    this.code = code
    this.httpStatus = options?.httpStatus ?? null
    this.retryAfterMs = options?.retryAfterMs ?? null
    this.retryable = isRetryableProviderError(code, options?.httpStatus ?? null)
  }
}

export function isAiProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError
}

export function isRetryableProviderError(
  code: AiProviderErrorCode,
  httpStatus: number | null,
): boolean {
  if (code === 'RATE_LIMITED' || code === 'TIMEOUT' || code === 'NETWORK_ERROR') return true
  if (code === 'PROVIDER_UNAVAILABLE' && httpStatus !== null && httpStatus >= 500) return true
  return false
}

const HTTP_STATUS_TO_CODE: Record<number, AiProviderErrorCode> = {
  401: 'INVALID_KEY',
  403: 'INVALID_KEY',
  404: 'MODEL_UNAVAILABLE',
  408: 'TIMEOUT',
  429: 'RATE_LIMITED',
  502: 'PROVIDER_UNAVAILABLE',
  503: 'PROVIDER_UNAVAILABLE',
  504: 'TIMEOUT',
}

export function providerErrorFromHttpStatus(
  status: number,
  bodyText: string,
  retryAfterHeader: string | null,
): AiProviderError {
  const code = HTTP_STATUS_TO_CODE[status] ?? (status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'INVALID_RESPONSE')
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader)
  return new AiProviderError(code, summarizeProviderBody(status, bodyText), {
    httpStatus: status,
    retryAfterMs,
  })
}

export function providerErrorFromNetwork(error: unknown): AiProviderError {
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  if (name === 'AbortError' || /aborted|abort/i.test(message)) {
    return new AiProviderError('TIMEOUT', 'The NVIDIA request was aborted before a response arrived.', {
      cause: error,
    })
  }
  if (/certificate|tls|ssl|unable to verify|cert_/i.test(message)) {
    return new AiProviderError('TLS_ERROR', 'The NVIDIA TLS handshake failed.', { cause: error })
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return new AiProviderError('TIMEOUT', 'The NVIDIA request timed out.', { cause: error })
  }
  return new AiProviderError('NETWORK_ERROR', 'The NVIDIA endpoint could not be reached.', {
    cause: error,
  })
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const date = Date.parse(header)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - Date.now())
}

function summarizeProviderBody(status: number, bodyText: string): string {
  // NVIDIA hosted workers can reject requests before inference begins.
  // Keep the worker occupancy visible without mislabeling it as a bad API key.
  if (status === 503 && /ResourceExhausted|Worker local total request limit reached/i.test(bodyText)) {
    const capacity = bodyText.match(/\b(\d+\s*\/\s*\d+)\b/)?.[1] ?? 'full'
    return `NVIDIA hosted inference workers are currently saturated (${capacity}). The request was not processed. Retry later or choose a different available model.`
  }
  const trimmed = bodyText.trim().slice(0, 280)
  if (!trimmed) return `NVIDIA returned HTTP ${status} with an empty body.`
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { error?: unknown; message?: unknown }
      const nested =
        record.error && typeof record.error === 'object'
          ? (record.error as { message?: unknown }).message
          : record.error
      const message = typeof nested === 'string' ? nested : typeof record.message === 'string' ? record.message : null
      if (message) return `NVIDIA returned HTTP ${status}: ${message.slice(0, 200)}`
    }
  } catch {
    // not JSON
  }
  return `NVIDIA returned HTTP ${status}.`
}

export function assertKnownProviderErrorCode(code: string): code is AiProviderErrorCode {
  return (AI_PROVIDER_ERROR_CODES as readonly string[]).includes(code)
}
