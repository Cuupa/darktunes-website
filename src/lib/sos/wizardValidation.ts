import type { ArtistRevenue, LabelArtist, SplitFee } from '@/lib/sos/types'

export type WizardIssueSeverity = 'error' | 'warning'

export interface WizardValidationIssue {
  id: string
  severity: WizardIssueSeverity
  title: string
  description: string
  actionLabel?: string
  actionTarget?: 'rules-mappings' | 'rules-splits' | 'rules-defaults' | 'upload' | 'settlements'
}

export interface WizardValidationInput {
  revenues: ArtistRevenue[]
  labelArtists: LabelArtist[]
  splitFees: SplitFee[]
  periodStart: string
  periodEnd: string
  hasBelieveFile: boolean
  hasBandcampFile: boolean
  hasShopifyFile: boolean
  hasPrintfulFile: boolean
  hasDarkmerchFile: boolean
  draftArtistNames?: string[]
}

function rosterArtistIds(artists: LabelArtist[]): Set<string> {
  return new Set(
    artists
      .map((a) => a.artistId?.trim())
      .filter((id): id is string => !!id),
  )
}

function rosterNames(artists: LabelArtist[]): Set<string> {
  return new Set(artists.map((a) => a.name.toLowerCase()))
}

export function validateSosWizardState(input: WizardValidationInput): WizardValidationIssue[] {
  const issues: WizardValidationIssue[] = []
  const rosterIds = rosterArtistIds(input.labelArtists)
  const roster = rosterNames(input.labelArtists)
  const splitByArtist = new Map(
    input.splitFees.map((s) => [s.artist.toLowerCase(), s]),
  )

  if (!input.periodStart || !input.periodEnd) {
    issues.push({
      id: 'missing-period',
      severity: 'error',
      title: 'Abrechnungszeitraum fehlt',
      description: 'Bitte Start- und Endmonat im Setup-Schritt angeben.',
      actionLabel: 'Zum Setup',
      actionTarget: 'upload',
    })
  }

  if (input.revenues.length === 0) {
    issues.push({
      id: 'no-revenues',
      severity: 'error',
      title: 'Keine Umsätze berechnet',
      description: 'Laden Sie mindestens eine Distributor-CSV hoch und warten Sie auf die Verarbeitung.',
      actionLabel: 'Zum Upload',
      actionTarget: 'upload',
    })
  }

  for (const revenue of input.revenues) {
    const key = revenue.artist.toLowerCase()
    const rosterMatch = roster.has(key)
    const mappedArtist = input.labelArtists.find(
      (a) => a.name.toLowerCase() === key,
    )
    const hasPortalId = mappedArtist?.artistId?.trim()

    if (!rosterMatch && revenue.totalRevenue > 0) {
      issues.push({
        id: `unknown-artist-${key}`,
        severity: 'warning',
        title: `Unbekannter Künstler: ${revenue.artist}`,
        description:
          'Dieser Name ist nicht im Label-Roster. Legen Sie ein Artist-Mapping an oder prüfen Sie die Schreibweise.',
        actionLabel: 'Mappings öffnen',
        actionTarget: 'rules-mappings',
      })
    }

    if (rosterMatch && !hasPortalId && revenue.finalAmount > 0) {
      issues.push({
        id: `no-portal-id-${key}`,
        severity: 'warning',
        title: `Kein Portal-Link: ${revenue.artist}`,
        description:
          'Für diesen Künstler fehlt die Portal-Verknüpfung. Draft-Upload und Benachrichtigung sind eingeschränkt.',
        actionLabel: 'Roster prüfen',
        actionTarget: 'rules-mappings',
      })
    }

    if (revenue.totalRevenue > 0 && !splitByArtist.has(key)) {
      issues.push({
        id: `missing-split-${key}`,
        severity: 'warning',
        title: `Kein individueller Split: ${revenue.artist}`,
        description:
          'Es wird der Label-Standard-Split verwendet. Prüfen Sie, ob das korrekt ist.',
        actionLabel: 'Splits öffnen',
        actionTarget: 'rules-splits',
      })
    }

    if (revenue.totalRevenue > 0 && Math.abs(revenue.finalAmount) < 0.005) {
      issues.push({
        id: `zero-payout-${key}`,
        severity: 'warning',
        title: `Null-Auszahlung: ${revenue.artist}`,
        description:
          'Umsatz vorhanden, aber Auszahlung ist 0 €. Prüfen Sie Splits, Gebühren und Ausgaben.',
        actionLabel: 'Defaults öffnen',
        actionTarget: 'rules-defaults',
      })
    }
  }

  if (input.draftArtistNames && input.draftArtistNames.length > 0) {
    for (const name of input.draftArtistNames) {
      issues.push({
        id: `existing-draft-${name.toLowerCase()}`,
        severity: 'error',
        title: `Entwurf existiert: ${name}`,
        description:
          'Für diesen Künstler und Zeitraum gibt es bereits einen Draft. Löschen Sie den Entwurf oder erstellen Sie eine Korrektur.',
        actionLabel: 'Zur Abrechnung',
        actionTarget: 'settlements',
      })
    }
  }

  const hasAnyFile =
    input.hasBelieveFile ||
    input.hasBandcampFile ||
    input.hasShopifyFile ||
    input.hasPrintfulFile ||
    input.hasDarkmerchFile

  if (!hasAnyFile && input.revenues.length === 0) {
    issues.push({
      id: 'no-files',
      severity: 'error',
      title: 'Keine Dateien hochgeladen',
      description: 'Laden Sie Believe, Bandcamp, Shopify, Printful oder Darkmerch CSVs hoch.',
      actionLabel: 'Zum Upload',
      actionTarget: 'upload',
    })
  }

  const errors = issues.filter((i) => i.severity === 'error')
  if (errors.length === 0 && rosterIds.size === 0 && input.labelArtists.length > 0) {
    issues.push({
      id: 'roster-no-portal-ids',
      severity: 'warning',
      title: 'Roster ohne Portal-IDs',
      description:
        'Kein Künstler im Roster hat eine Portal-Verknüpfung. Statement-Uploads sind nicht möglich.',
      actionLabel: 'Roster prüfen',
      actionTarget: 'rules-mappings',
    })
  }

  return issues
}

export function wizardHasBlockingIssues(issues: WizardValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}