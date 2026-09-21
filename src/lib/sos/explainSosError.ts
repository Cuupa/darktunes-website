export const SOS_ERROR_FALLBACK = {
  explainNetwork:
    'The browser could not reach the server (offline, VPN, or a blocked request). This is not because the file is too big. Check the connection, then retry.',
  explainSession:
    'You were signed out or the login timed out, so the server refused the action. Sign in again, then retry this step.',
  explainForbidden:
    'This account is not allowed to change money documents. Editors can look, but only a label admin can publish, pay, or lock a period.',
  explainConflict:
    'Someone else or another browser tab saved first, so this change was not written. Reload, then retry so you do not overwrite their work.',
  explainPeriodLocked:
    'This billing period is locked or archived on purpose, so paid statements cannot silently change. Use a correction, or work in a new period.',
  explainNotFound:
    'This statement, invoice, or file is no longer there (deleted, or the link is old). Reload the list. If it is gone, recreate it.',
  explainStorage:
    'The file archive refused the upload. The sales file itself is fine — storage permissions or browser access to the archive are not. Retry archive; if it keeps failing, the archive setup needs a check.',
  explainTooLarge:
    'This file is larger than this upload path allows. Use the normal archive upload, or split the file. Do not keep retrying the small fallback path.',
  explainRateLimited:
    'The server paused new requests because too many arrived at once. Wait a few seconds, then retry once.',
  explainTimeout:
    'The transfer took too long and was stopped. The file may still be uploading. Wait, then retry; if it keeps happening, try a smaller file.',
  explainCsvParse:
    'The sales file could not be read as a table. Typical causes: not a CSV, unusual separators, or a broken distributor export. Export CSV again from the source, then re-upload.',
  explainFailed: 'This step did not finish.',
  explainUnknown:
    'This step failed and the server did not say why. Reload and retry. If it happens again, note the time and what you clicked, and tell support.',
} as const

export type SosErrorLabels = typeof SOS_ERROR_FALLBACK

function asText(raw: unknown): string {
  if (raw instanceof Error) return raw.message.trim()
  if (typeof raw === 'string') return raw.trim()
  return ''
}

const ALREADY_SPEAKING =
  /^(the browser could not reach|you were signed out|this account is not allowed|someone else or another|this billing period is locked|this statement, invoice|the file archive refused|this file is larger|the server paused|the transfer took too long|the sales file could not be read|this step did not finish|this step failed and the server|no connection to the server|your session expired|could not reach file storage)/i

export function explainSosError(
  raw: unknown,
  labels: Partial<Record<keyof SosErrorLabels, string>> = {},
): string {
  const t = { ...SOS_ERROR_FALLBACK, ...labels }
  const text = asText(raw)
  if (!text) return t.explainUnknown
  if (Object.values(t).includes(text) || ALREADY_SPEAKING.test(text)) return text

  const lower = text.toLowerCase()

  if (
    /failed to fetch|networkerror|network request failed|load failed|err_network|err_internet/.test(lower)
  ) {
    return t.explainNetwork
  }
  if (/not authenticated|session expired|jwt expired|invalid jwt|\b401\b/.test(lower)) {
    return t.explainSession
  }
  if (/r2 |cors|accessdenied|nosuchbucket|put failed/.test(lower)) {
    return t.explainStorage
  }
  if (/admin role required|not authorized|forbidden:/.test(lower)) {
    return t.explainForbidden
  }
  if (/settlement_period_locked|period is locked|period is archived|not writable/.test(lower)) {
    return t.explainPeriodLocked
  }
  if (
    /statement_status_conflict|revision conflict|concurrent update|workspace was changed/.test(lower)
  ) {
    return t.explainConflict
  }
  if (/\b404\b|pgrst116|not found/.test(lower)) {
    return t.explainNotFound
  }
  if (/too large|payload too large|\b413\b/.test(lower)) {
    return t.explainTooLarge
  }
  if (/\b429\b|rate limit|too many requests/.test(lower)) {
    return t.explainRateLimited
  }
  if (/timed out|timeout|aborted|aborterror/.test(lower)) {
    return t.explainTimeout
  }
  if (/parse error|papa parse|delimiter|malformed csv|unexpected token/.test(lower)) {
    return t.explainCsvParse
  }

  return t.explainUnknown
}
