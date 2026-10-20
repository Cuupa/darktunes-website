import { classifyError, isSoftwareDefect } from '@/lib/ai/diagnostics/classify'
import { developerErrorReportSchema, type DeveloperErrorReport } from '@/lib/ai/validation/developerReport'
import { projectDiagnosticRecord } from '@/lib/ai/diagnostics/project'

export function buildDeveloperErrorReport(input: {
  errorId: string
  log: Record<string, unknown>
}): DeveloperErrorReport {
  const projected = projectDiagnosticRecord(input.log)
  const message = typeof input.log.message === 'string' ? input.log.message : 'Unknown error'
  const source = typeof input.log.source === 'string' ? input.log.source : 'unknown'
  const classification = classifyError({
    httpStatus: typeof input.log.http_status === 'number' ? input.log.http_status : null,
    message,
    source,
  })
  const defect = isSoftwareDefect(classification)
  const report = {
    title: message.slice(0, 120),
    error_id: input.errorId,
    fingerprint: typeof input.log.fingerprint === 'string' ? input.log.fingerprint : null,
    severity: defect ? 'high' : 'low',
    status: input.log.resolved === true ? 'resolved' : input.log.ignored === true ? 'ignored' : 'open',
    affected_page: typeof input.log.route_path === 'string' ? input.log.route_path : null,
    affected_feature: source,
    first_seen_at: typeof input.log.first_seen_at === 'string' ? input.log.first_seen_at : null,
    last_seen_at: typeof input.log.last_seen_at === 'string' ? input.log.last_seen_at : null,
    occurrences: typeof input.log.occurrences === 'number' ? input.log.occurrences : 1,
    affected_user_count: null,
    app_version: typeof input.log.app_version === 'string' ? input.log.app_version : null,
    deployment: typeof input.log.deployment_id === 'string' ? input.log.deployment_id : null,
    expected_behavior: 'The action completes without an unexpected server failure.',
    actual_behavior: message.slice(0, 400),
    reproduction_steps: [
      typeof input.log.route_path === 'string' ? `Open ${input.log.route_path}` : 'Open the affected page',
      'Repeat the action that produced this error reference.',
    ],
    relevant_messages: [message.slice(0, 400)],
    correlations: Object.keys(projected)
      .filter((key) => projected[key] != null)
      .map((key) => `${key}=${String(projected[key])}`),
    probable_causes: [
      {
        hypothesis: defect
          ? 'A server-side failure occurred while handling this request.'
          : 'This looks like a user, auth, or validation outcome rather than a platform defect.',
        confidence: defect ? 'possible' : 'likely',
        evidence: [`classification=${classification}`, `source=${source}`],
      },
    ],
    missing_information: [
      'No repository files or source maps were read for this report.',
      'User-identifying fields were stripped from the diagnostic projection.',
    ],
    recommended_actions: defect
      ? ['Search Admin → System → Log Manager for the error ID.', 'Check the latest deployment and related sync jobs.']
      : ['Confirm the user can retry the original action.', 'Do not treat this as a production incident unless it repeats.'],
    possible_regression: Boolean(input.log.app_version),
    test_suggestions: ['Reproduce with the same route and role.', 'Confirm the fingerprint does not leak other users’ data.'],
    diagnosis_confidence: defect ? 'possible' : 'likely',
  } satisfies DeveloperErrorReport

  return developerErrorReportSchema.parse(report)
}
