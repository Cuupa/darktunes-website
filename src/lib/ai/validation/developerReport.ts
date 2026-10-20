import { z } from 'zod'

export const hypothesisConfidenceSchema = z.enum(['confirmed', 'likely', 'possible', 'unknown'])

export const developerErrorReportSchema = z.object({
  title: z.string(),
  error_id: z.string(),
  fingerprint: z.string().nullable(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  status: z.enum(['open', 'resolved', 'ignored']),
  affected_page: z.string().nullable(),
  affected_feature: z.string().nullable(),
  first_seen_at: z.string().nullable(),
  last_seen_at: z.string().nullable(),
  occurrences: z.number().int().nonnegative(),
  affected_user_count: z.number().int().nonnegative().nullable(),
  app_version: z.string().nullable(),
  deployment: z.string().nullable(),
  expected_behavior: z.string(),
  actual_behavior: z.string(),
  reproduction_steps: z.array(z.string()),
  relevant_messages: z.array(z.string()),
  correlations: z.array(z.string()),
  probable_causes: z.array(
    z.object({
      hypothesis: z.string(),
      confidence: hypothesisConfidenceSchema,
      evidence: z.array(z.string()),
    }),
  ),
  missing_information: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  possible_regression: z.boolean(),
  test_suggestions: z.array(z.string()),
  diagnosis_confidence: hypothesisConfidenceSchema,
})

export type DeveloperErrorReport = z.infer<typeof developerErrorReportSchema>
