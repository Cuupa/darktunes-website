'use client'

/**
 * src/components/admin/AccountingPanel.tsx
 *
 * Two-tab accounting panel:
 *  Tab A — "Generate Statements": full SOS Generator workflow embedded in admin.
 *           Artists come from useArtists() (no CSV roster upload needed).
 *  Tab B — "Statement History": read-only view of uploaded PDFs (StatementsManager).
 */

import { lazy, Suspense, useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { monthToPeriodDate } from '@/lib/sos/lineItemsFromArtistData'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { horizontalScrollClass } from '@/components/ui/scroll-panel'
import { cn } from '@/lib/utils'
import { useArtists } from '@/hooks/useArtists'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useCSVProcessor } from '@/hooks/useSosCSVProcessor'
import { useExports } from '@/hooks/useSosExports'
import { useFileManager } from '@/hooks/useSosFileManager'
import { mapArtistsToLabelArtists } from '@/lib/sos/artistBridge'
import type {
  LabelInfo, PdfExportSettings, AppDefaults,
  ArtistMapping, CompilationFilter, SplitFee,
  ManualRevenue, ExpenseEntry, IgnoredEntry,
  CSVColumnAlias, EmailConfig, TrackRevenueAssignment,
} from '@/lib/sos/types'
import { DEFAULT_PDF_EXPORT_SETTINGS, DEFAULT_APP_DEFAULTS, DEFAULT_EMAIL_CONFIG, DEFAULT_LABEL_INFO } from '@/lib/sos/defaults'
import {
  DEFAULT_SOS_ACCOUNTING_SETTINGS,
  type SosAccountingSettings,
} from '@/lib/sos/sosAccountingSettings'
import type { CsvImportProfile } from '@/lib/sos/ingest/types'
import {
  ASSISTANT_WIZARD_STEP_IDS,
  QUICK_WIZARD_STEP_IDS,
  type GuidedWizardStep,
} from '@/lib/sos/guidedWizard'
import { SosWizardModeChooser, type SosWizardMode } from '@/components/admin/sos/SosWizardModeChooser'
import { SosSetupWizardStep } from '@/components/admin/sos/SosSetupWizardStep'
import { SosValidationPanel } from '@/components/admin/sos/SosValidationPanel'
import {
  validateSosWizardState,
  wizardHasBlockingIssues,
  type WizardValidationIssue,
} from '@/lib/sos/wizardValidation'
import { UniversalFileUploadZone } from '@/components/admin/sos/UniversalFileUploadZone'
import { ReportingPanel } from '@/components/admin/sos/ReportingPanel'
import { AccountingGuidedWizard } from '@/components/admin/sos/AccountingGuidedWizard'
import { SettlementCenterPanel } from '@/components/admin/sos/SettlementCenterPanel'
import { PayoutManager } from '@/components/admin/sos/PayoutManager'
import { PdfExportSettingsPanel } from '@/components/admin/sos/PdfExportSettingsPanel'
import { RulesPanel } from '@/components/admin/sos/RulesPanel'
import { SosAnalyticsPersistPanel } from '@/components/admin/sos/SosAnalyticsPersistPanel'
import { OperatorPlaybook } from '@/components/admin/sos/OperatorPlaybook'
import { ImportBatchesPanel } from '@/components/admin/sos/ImportBatchesPanel'
import { SosConfirmDialog } from '@/components/admin/sos/SosConfirmDialog'
import { ExternalMetricsSyncPanel } from '@/components/admin/sos/ExternalMetricsSyncPanel'
import dynamic from 'next/dynamic'
const TrendsDashboard = dynamic(() => import('@/components/admin/sos/TrendsDashboard').then(mod => mod.TrendsDashboard), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> })
import { CsvProfileManager } from '@/components/admin/sos/CsvProfileManager'
import { CsvImportProfileEditor } from '@/components/admin/sos/CsvImportProfileEditor'
import { AdminEnterpriseAnalytics } from '@/components/admin/sos/AdminEnterpriseAnalytics'
import { useCsvImportProfiles } from '@/hooks/useCsvImportProfiles'
import { useSosWorkspaceSync } from '@/hooks/useSosWorkspaceSync'
import { WorkspaceManager } from '@/components/admin/sos/WorkspaceManager'

import {
  Wallet, ClockCounterClockwise, FileText, Bank, Sliders,
  ChartBar, TrendUp, BookmarkSimple, DownloadSimple, Table, SealCheck, Sparkle,
} from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

const StatementsManager = lazy(
  () => import('@/components/admin/StatementsManager').then(m => ({ default: m.StatementsManager }))
)

type SubTab = 'upload' | 'reporting' | 'settlements' | 'analytics' | 'payout' | 'rules' | 'trends'

type ViewMode = 'guided' | 'advanced'

const SUB_TAB_IDS: SubTab[] = ['upload', 'reporting', 'settlements', 'analytics', 'payout', 'trends', 'rules']

function isSubTab(value: string | null): value is SubTab {
  return value != null && (SUB_TAB_IDS as string[]).includes(value)
}

function SosGeneratorPanel() {
  const searchParams = useSearchParams()
  const t = useAccountingLabels()
  const { artists } = useArtists()
  const { settings } = useSiteSettings()
  // Map portal artists to SOS LabelArtist[]
  const labelArtists = useMemo(() => mapArtistsToLabelArtists(artists), [artists])

  const [labelBranding, setLabelBranding] = useState<Partial<LabelInfo>>(DEFAULT_LABEL_INFO)
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>(DEFAULT_PDF_EXPORT_SETTINGS)
  const [csvImportProfilesCustom, setCsvImportProfilesCustom] = useState<CsvImportProfile[]>([])
  const {
    profiles: csvImportProfiles,
    customProfiles,
    saveProfile: saveCsvProfile,
    deleteProfile: deleteCsvProfile,
  } = useCsvImportProfiles(csvImportProfilesCustom, setCsvImportProfilesCustom)

  // Site settings override public branding fields; SEPA/bank details persist in Supabase.
  const labelInfo = useMemo<LabelInfo>(() => ({
    ...DEFAULT_LABEL_INFO,
    ...labelBranding,
    name: settings.labelName ?? labelBranding?.name ?? DEFAULT_LABEL_INFO.name,
    address: settings.impressumAddress ?? labelBranding?.address ?? DEFAULT_LABEL_INFO.address,
    taxId: settings.impressumVatId ?? labelBranding?.taxId ?? DEFAULT_LABEL_INFO.taxId,
  }), [labelBranding, settings])

  const handleLabelSepaUpdate = useCallback(
    (sepaIban: string, sepaAccountHolder: string) => {
      setLabelBranding((current) => ({
        ...DEFAULT_LABEL_INFO,
        ...current,
        sepaIban: sepaIban.replace(/\s/g, '').toUpperCase(),
        sepaAccountHolder: sepaAccountHolder.trim(),
      }))
    },
    [],
  )

  const [appDefaults, setAppDefaults] = useState<AppDefaults>(DEFAULT_APP_DEFAULTS)
  const [emailConfig, setEmailConfig] = useState<Partial<EmailConfig>>(DEFAULT_EMAIL_CONFIG)
  const [showPdfSettings, setShowPdfSettings] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('guided')
  const [wizardMode, setWizardMode] = useState<SosWizardMode | null>(null)
  const [guidedStep, setGuidedStep] = useState<GuidedWizardStep>('upload')
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('upload')
  const [manualPeriodStart, setManualPeriodStart] = useState('')
  const [manualPeriodEnd, setManualPeriodEnd] = useState('')
  const [workspaceDeleteOpen, setWorkspaceDeleteOpen] = useState(false)
  const [workspaceDeleting, setWorkspaceDeleting] = useState(false)

  useEffect(() => {
    const subTab = searchParams.get('subTab')
    const guidedStepParam = searchParams.get('guidedStep')
    if (subTab === 'settlements') {
      setViewMode('guided')
      setWizardMode('quick')
      setGuidedStep('settle')
      return
    }
    if (isSubTab(subTab)) {
      setViewMode('advanced')
      setActiveSubTab(subTab)
    }
    if (
      guidedStepParam === 'upload' ||
      guidedStepParam === 'review' ||
      guidedStepParam === 'settle' ||
      guidedStepParam === 'setup' ||
      guidedStepParam === 'validate'
    ) {
      setViewMode('guided')
      setWizardMode(guidedStepParam === 'setup' || guidedStepParam === 'validate' ? 'assistant' : 'quick')
      setGuidedStep(guidedStepParam)
    }
  }, [searchParams])

  // Rules state
  const [artistMappings, setArtistMappings] = useState<ArtistMapping[]>([])
  const [compilationFilters, setCompilationFilters] = useState<CompilationFilter[]>([])
  const [splitFees, setSplitFees] = useState<SplitFee[]>([])
  const [manualRevenues, setManualRevenues] = useState<ManualRevenue[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [ignoredEntries, setIgnoredEntries] = useState<IgnoredEntry[]>([])
  const [csvAliases, setCsvAliases] = useState<CSVColumnAlias[]>([])
  const [trackRevenueAssignments, setTrackRevenueAssignments] = useState<TrackRevenueAssignment[]>([])

  const settingsBundle = useMemo<SosAccountingSettings>(
    () => ({
      artistMappings,
      compilationFilters,
      splitFees,
      manualRevenues,
      expenses,
      ignoredEntries,
      csvAliases,
      trackRevenueAssignments,
      appDefaults,
      emailConfig,
      labelInfo: labelBranding,
      pdfSettings,
      csvImportProfiles: csvImportProfilesCustom,
    }),
    [
      artistMappings,
      compilationFilters,
      splitFees,
      manualRevenues,
      expenses,
      ignoredEntries,
      csvAliases,
      trackRevenueAssignments,
      appDefaults,
      emailConfig,
      labelBranding,
      pdfSettings,
      csvImportProfilesCustom,
    ],
  )

  const applySettings = useCallback((bundle: SosAccountingSettings) => {
    setArtistMappings(bundle.artistMappings)
    setCompilationFilters(bundle.compilationFilters)
    setSplitFees(bundle.splitFees)
    setManualRevenues(bundle.manualRevenues)
    setExpenses(bundle.expenses)
    setIgnoredEntries(bundle.ignoredEntries)
    setCsvAliases(bundle.csvAliases)
    setTrackRevenueAssignments(bundle.trackRevenueAssignments)
    setAppDefaults(bundle.appDefaults)
    setEmailConfig(bundle.emailConfig)
    setLabelBranding(bundle.labelInfo ?? DEFAULT_LABEL_INFO)
    setPdfSettings(bundle.pdfSettings ?? DEFAULT_PDF_EXPORT_SETTINGS)
    setCsvImportProfilesCustom(bundle.csvImportProfiles ?? [])
  }, [])

  const handleSubTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tabId: SubTab) => {
      const currentIndex = SUB_TAB_IDS.indexOf(tabId)
      if (currentIndex < 0) return
      let nextIndex = currentIndex
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SUB_TAB_IDS.length
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + SUB_TAB_IDS.length) % SUB_TAB_IDS.length
      else if (event.key === 'Home') nextIndex = 0
      else if (event.key === 'End') nextIndex = SUB_TAB_IDS.length - 1
      else return
      event.preventDefault()
      const nextTab = SUB_TAB_IDS[nextIndex]
      if (nextTab) setActiveSubTab(nextTab)
    },
    [setActiveSubTab],
  )

  // Artist mapping handlers
  const handleAddMapping = useCallback((m: Omit<ArtistMapping, 'id'>) => {
    setArtistMappings(prev => [...prev, { ...m, id: uuidv4() }])
  }, [])
  const handleRemoveMapping = useCallback((id: string) => {
    setArtistMappings(prev => prev.filter(m => m.id !== id))
  }, [])
  const handleUpdateMapping = useCallback((id: string, m: Omit<ArtistMapping, 'id'>) => {
    setArtistMappings(prev => prev.map(e => e.id === id ? { ...m, id } : e))
  }, [])

  // Compilation filter handlers
  const handleAddFilter = useCallback((f: Omit<CompilationFilter, 'id'>) => {
    setCompilationFilters(prev => [...prev, { ...f, id: uuidv4() }])
  }, [])
  const handleRemoveFilter = useCallback((id: string) => {
    setCompilationFilters(prev => prev.filter(f => f.id !== id))
  }, [])

  // Split fee handlers
  const handleAddSplitFee = useCallback((fee: SplitFee) => {
    setSplitFees(prev => [...prev.filter(f => f.artist !== fee.artist), fee])
  }, [])
  const handleRemoveSplitFee = useCallback((artist: string) => {
    setSplitFees(prev => prev.filter(f => f.artist !== artist))
  }, [])
  const handleUpdateSplitFee = useCallback((artist: string, update: Omit<SplitFee, 'artist'>) => {
    setSplitFees(prev => prev.map(f => f.artist === artist ? { artist, ...update } : f))
  }, [])

  // Manual revenue handlers
  const handleAddRevenue = useCallback((r: Omit<ManualRevenue, 'id'>) => {
    setManualRevenues(prev => [...prev, { ...r, id: uuidv4() }])
  }, [])
  const handleRemoveRevenue = useCallback((id: string) => {
    setManualRevenues(prev => prev.filter(r => r.id !== id))
  }, [])
  const handleUpdateRevenue = useCallback((id: string, r: Omit<ManualRevenue, 'id'>) => {
    setManualRevenues(prev => prev.map(e => e.id === id ? { ...r, id } : e))
  }, [])

  // Expense handlers
  const handleAddExpense = useCallback((e: Omit<ExpenseEntry, 'id'>) => {
    setExpenses(prev => [...prev, { ...e, id: uuidv4() }])
  }, [])
  const handleRemoveExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id))
  }, [])
  const handleUpdateExpense = useCallback((id: string, e: Omit<ExpenseEntry, 'id'>) => {
    setExpenses(prev => prev.map(entry => entry.id === id ? { ...e, id } : entry))
  }, [])

  // Ignored entry handlers
  const handleAddIgnoredEntry = useCallback((e: Omit<IgnoredEntry, 'id' | 'createdAt'>) => {
    setIgnoredEntries(prev => [...prev, { ...e, id: uuidv4(), createdAt: new Date().toISOString() }])
  }, [])
  const handleRemoveIgnoredEntry = useCallback((id: string) => {
    setIgnoredEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  // CSV alias handlers
  const handleAddCsvAlias = useCallback((alias: Omit<CSVColumnAlias, 'id'>) => {
    setCsvAliases(prev => [...prev, { ...alias, id: uuidv4() }])
  }, [])
  const handleRemoveCsvAlias = useCallback((id: string) => {
    setCsvAliases(prev => prev.filter(a => a.id !== id))
  }, [])

  // Track revenue assignment handlers
  const handleAddTrackAssignment = useCallback((a: TrackRevenueAssignment) => {
    setTrackRevenueAssignments(prev => [...prev, a])
  }, [])
  const handleRemoveTrackAssignment = useCallback((id: string) => {
    setTrackRevenueAssignments(prev => prev.filter(a => a.id !== id))
  }, [])

  const handleWorkspaceImport = useCallback((bundle: Partial<SosAccountingSettings>) => {
    applySettings({
      ...DEFAULT_SOS_ACCOUNTING_SETTINGS,
      ...settingsBundle,
      ...bundle,
      labelInfo: { ...settingsBundle.labelInfo, ...bundle.labelInfo },
      pdfSettings: { ...settingsBundle.pdfSettings, ...bundle.pdfSettings },
    })
  }, [applySettings, settingsBundle])

  const handlePresetLoad = useCallback((preset: SosAccountingSettings) => {
    applySettings(preset)
  }, [applySettings])

  // File managers for each source
  const believeManager   = useFileManager('believe')
  const bandcampManager  = useFileManager('bandcamp')
  const shopifyManager   = useFileManager('shopify')
  const printfulManager  = useFileManager('printful')
  const darkmerchManager = useFileManager('darkmerch')
  const [carryForwardByArtist, setCarryForwardByArtist] = useState<Record<string, number>>({})

  // Load a bronze archive into the appropriate in-memory file manager for processing.
  // CSV is fetched via presigned R2 GET (bypasses Vercel response size limit).
  const loadBronzeBatch = useCallback(async (batch: { id: string; distributor: string; periodStart: string }) => {
    try {
      const { downloadBronzeCsvText } = await import('@/lib/sos/bronzeDownload')
      const csvText = await downloadBronzeCsvText(batch.id)
      const fileName = `${batch.distributor}-${batch.periodStart || 'archive'}.csv`
      const blob = new Blob([csvText], { type: 'text/csv; charset=utf-8' })
      const file = new File([blob], fileName, { type: 'text/csv; charset=utf-8' })
      const dist = batch.distributor as 'believe' | 'bandcamp' | 'shopify' | 'printful' | 'darkmerch'
      if (dist === 'believe') await believeManager.addFiles([file])
      else if (dist === 'bandcamp') await bandcampManager.addFiles([file])
      else if (dist === 'shopify') await shopifyManager.addFiles([file])
      else if (dist === 'printful') await printfulManager.addFiles([file])
      else if (dist === 'darkmerch') await darkmerchManager.addFiles([file])
      else throw new Error(`Unsupported distributor: ${dist}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.bronzeArchiveLoadError
      toast.error(msg)
      throw err
    }
  }, [
    believeManager,
    bandcampManager,
    shopifyManager,
    printfulManager,
    darkmerchManager,
    t.bronzeArchiveLoadError,
  ])

  // CSV processing — all config fields now wired
  const {
    isProcessing,
    revenues,
    processedData,
    detectedPeriodStart,
    detectedPeriodEnd,
    uniqueArtists,
    releaseTitlesByArtistIncFeaturing,
    territoryMetrics,
    merchOrderRows,
  } = useCSVProcessor(
    believeManager.files,
    bandcampManager.files,
    {
      compilationFilters,
      artistMappings,
      splitFees,
      manualRevenues,
      expenses,
      excludePhysical: false,
      csvAliases,
      labelArtists,
      ignoredEntries,
      distributionFeePercentage: appDefaults.distributionFeePercentage ?? 0,
      distributionFeeDigital:    appDefaults.distributionFeeDigital,
      distributionFeePhysical:   appDefaults.distributionFeePhysical,
      defaultSplitPercentage:    appDefaults.defaultSplitPercentage,
      defaultSplitPercentageDigital:  appDefaults.defaultSplitPercentageDigital,
      defaultSplitPercentagePhysical: appDefaults.defaultSplitPercentagePhysical,
      sourceSplits:              appDefaults.sourceSplits,
      trackRevenueAssignments,
      carryForwardByArtist,
    },
    shopifyManager.files,
    printfulManager.files,
    darkmerchManager.files,
  )

  useEffect(() => {
    const periodStartDate = monthToPeriodDate(detectedPeriodStart, false)
    const periodEndDate = monthToPeriodDate(detectedPeriodEnd || detectedPeriodStart, true)
    if (!periodStartDate || !periodEndDate) {
      setCarryForwardByArtist({})
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return

        const params = new URLSearchParams({
          periodStart: periodStartDate,
          periodEnd: periodEndDate,
        })
        const response = await fetch(`/api/admin/settlements/register?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok || cancelled) return

        const json = (await response.json()) as {
          rows?: Array<{ artistName: string; openingBalanceEur?: number }>
        }
        const map: Record<string, number> = {}
        for (const row of json.rows ?? []) {
          if (row.openingBalanceEur != null && row.openingBalanceEur !== 0) {
            map[row.artistName.toLowerCase()] = row.openingBalanceEur
          }
        }
        if (!cancelled) setCarryForwardByArtist(map)
      } catch {
        if (!cancelled) setCarryForwardByArtist({})
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detectedPeriodStart, detectedPeriodEnd])

  // Derive flat list of all release titles across all artists for IgnoredEntriesManager
  const allReleaseTitles = useMemo(() => {
    const titles = new Set<string>()
    for (const releases of Object.values(releaseTitlesByArtistIncFeaturing ?? {})) {
      for (const t of releases) titles.add(t)
    }
    return Array.from(titles).sort()
  }, [releaseTitlesByArtistIncFeaturing])

  const hasData = revenues.length > 0

  useEffect(() => {
    if (detectedPeriodStart && !manualPeriodStart) {
      setManualPeriodStart(detectedPeriodStart)
      setManualPeriodEnd(detectedPeriodEnd || detectedPeriodStart)
    }
  }, [detectedPeriodStart, detectedPeriodEnd, manualPeriodStart])

  const resetSession = useCallback(() => {
    believeManager.clearAll()
    bandcampManager.clearAll()
    shopifyManager.clearAll()
    printfulManager.clearAll()
    darkmerchManager.clearAll()
    setCarryForwardByArtist({})
    setGuidedStep(wizardMode === 'assistant' ? 'setup' : 'upload')
    toast.message('Session zurückgesetzt', {
      description: 'Alle hochgeladenen Dateien und lokale Berechnungen wurden gelöscht.',
    })
  }, [
    believeManager,
    bandcampManager,
    shopifyManager,
    printfulManager,
    darkmerchManager,
    wizardMode,
  ])

  const wizardValidationIssues = useMemo(() => {
    return validateSosWizardState({
      revenues,
      labelArtists,
      splitFees,
      periodStart: manualPeriodStart || detectedPeriodStart,
      periodEnd: manualPeriodEnd || detectedPeriodEnd || manualPeriodStart,
      hasBelieveFile: believeManager.files.length > 0,
      hasBandcampFile: bandcampManager.files.length > 0,
      hasShopifyFile: shopifyManager.files.length > 0,
      hasPrintfulFile: printfulManager.files.length > 0,
      hasDarkmerchFile: darkmerchManager.files.length > 0,
    })
  }, [
    revenues,
    labelArtists,
    splitFees,
    manualPeriodStart,
    manualPeriodEnd,
    detectedPeriodStart,
    detectedPeriodEnd,
    believeManager.files.length,
    bandcampManager.files.length,
    shopifyManager.files.length,
    printfulManager.files.length,
    darkmerchManager.files.length,
  ])

  const hasBlockingValidation = wizardHasBlockingIssues(wizardValidationIssues)

  const handleValidationAction = useCallback((issue: WizardValidationIssue) => {
    if (issue.actionTarget === 'rules-mappings' || issue.actionTarget === 'rules-splits' || issue.actionTarget === 'rules-defaults') {
      setViewMode('advanced')
      setActiveSubTab('rules')
      return
    }
    if (issue.actionTarget === 'upload') {
      setGuidedStep('upload')
      return
    }
    if (issue.actionTarget === 'settlements') {
      setGuidedStep('settle')
    }
  }, [])

  const bronzeBatchIds = useMemo(() => {
    const ids = new Set<string>()
    for (const file of [
      ...believeManager.files,
      ...bandcampManager.files,
      ...shopifyManager.files,
      ...printfulManager.files,
      ...darkmerchManager.files,
    ]) {
      if (file.bronzeBatchId) ids.add(file.bronzeBatchId)
    }
    return Array.from(ids)
  }, [
    believeManager.files,
    bandcampManager.files,
    shopifyManager.files,
    printfulManager.files,
    darkmerchManager.files,
  ])

  const exportPersistContext = useMemo(
    () =>
      hasData && territoryMetrics.length > 0
        ? {
            territoryMetrics,
            merchOrderRows,
            revenues,
            bronzeBatchIds,
          }
        : undefined,
    [hasData, territoryMetrics, merchOrderRows, revenues, bronzeBatchIds],
  )

  const {
    handleDownloadPDF,
    handleDownloadExcel,
    handleDownloadAll,
    handleDownloadSelected,
    handlePublishToPortal,
    buildCorrectionPdfBase64,
  } = useExports(
      processedData,
      labelInfo,
      detectedPeriodStart,
      detectedPeriodEnd,
      pdfSettings,
      appDefaults,
      labelArtists,
      emailConfig,
      compilationFilters,
      false,
      exportPersistContext,
    )

  const currentPeriodKey = useMemo(
    () =>
      detectedPeriodStart
        ? { start: detectedPeriodStart, end: detectedPeriodEnd || detectedPeriodStart }
        : null,
    [detectedPeriodStart, detectedPeriodEnd],
  )

  const {
    settingsReady,
    workspaceLoadedAt,
    workspaceUpdatedBy,
    defaultPresetLoadedAt,
    isWorkspaceLoading,
    isWorkspaceSaving,
    isSettingsDirty,
    loadFromServer,
    confirmReloadFromServer,
    reloadConfirmOpen,
    setReloadConfirmOpen,
    loadDefaultPreset,
    saveCurrentWorkspace,
  } = useSosWorkspaceSync({
    currentPeriodKey,
    settings: settingsBundle,
    applySettings,
    bronzeBatchIds,
    disabled: isProcessing,
  })

  const confirmWorkspaceDelete = useCallback(async () => {
    if (!currentPeriodKey) return
    setWorkspaceDeleting(true)
    try {
      const res = await fetch(
        `/api/admin/sos/workspaces?periodStart=${encodeURIComponent(currentPeriodKey.start)}&periodEnd=${encodeURIComponent(currentPeriodKey.end)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Workspace delete failed',
        )
      }
      toast.success('Workspace für diesen Zeitraum gelöscht')
      setWorkspaceDeleteOpen(false)
      await loadFromServer({ force: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Workspace delete failed')
    } finally {
      setWorkspaceDeleting(false)
    }
  }, [currentPeriodKey, loadFromServer])

  const rulesCount =
    artistMappings.length + compilationFilters.length + splitFees.length +
    manualRevenues.length + expenses.length + ignoredEntries.length +
    csvAliases.length + trackRevenueAssignments.length

  // Sub-tabs definition
  const subTabs: { id: SubTab; label: React.ReactNode }[] = [
    { id: 'upload',    label: t.subTabUpload },
    { id: 'reporting', label: t.subTabReporting },
    {
      id: 'settlements',
      label: (
        <>
          <SealCheck size={13} className="inline mr-1" />
          {t.subTabSettlements}
        </>
      ),
    },
    { id: 'analytics', label: <><ChartBar size={13} className="inline mr-1" />{t.subTabAnalytics}</> },
    { id: 'payout',    label: t.subTabPayout },
    { id: 'trends',    label: <><TrendUp size={13} className="inline mr-1" />{t.subTabTrends}</> },
    {
      id: 'rules',
      label: (
        <>
          <Sliders size={14} className="inline mr-1" />
          {t.subTabRules}
          {rulesCount > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
              {rulesCount}
            </span>
          )}
        </>
      ),
    },
  ]

  const setupPanel = (
    <SosSetupWizardStep
      periodStart={manualPeriodStart}
      periodEnd={manualPeriodEnd}
      onPeriodStartChange={setManualPeriodStart}
      onPeriodEndChange={setManualPeriodEnd}
      appDefaults={appDefaults}
      onAppDefaultsChange={setAppDefaults}
      labelInfo={labelInfo}
      onLabelInfoChange={setLabelBranding}
      onLoadPreset={() => void loadDefaultPreset()}
      presetLoading={isWorkspaceLoading}
    />
  )

  const validatePanel = (
    <SosValidationPanel issues={wizardValidationIssues} onIssueAction={handleValidationAction} />
  )

  const uploadPanel = (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Zeitraum: {manualPeriodStart || detectedPeriodStart || '—'}
          {(manualPeriodEnd || detectedPeriodEnd) &&
            (manualPeriodEnd || detectedPeriodEnd) !== (manualPeriodStart || detectedPeriodStart) &&
            ` – ${manualPeriodEnd || detectedPeriodEnd}`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={resetSession}>
          Neue Abrechnung starten
        </Button>
      </div>
      <UniversalFileUploadZone
        believeManager={believeManager}
        bandcampManager={bandcampManager}
        shopifyManager={shopifyManager}
        printfulManager={printfulManager}
        darkmerchManager={darkmerchManager}
        csvProfiles={csvImportProfiles}
        onAddAliases={(aliases) => {
          aliases.forEach((alias) => handleAddCsvAlias(alias))
        }}
      />
    </div>
  )

  const reviewPanel = hasData ? (
    <ReportingPanel
      revenues={revenues}
      onDownloadPDF={handleDownloadPDF}
      onDownloadExcel={handleDownloadExcel}
      onDownloadAll={handleDownloadAll}
      onDownloadSelected={handleDownloadSelected}
      labelArtists={labelArtists}
      labelInfo={labelInfo}
      appDefaults={appDefaults}
      emailConfig={emailConfig}
      periodStart={detectedPeriodStart}
      periodEnd={detectedPeriodEnd}
      onGoToSettlementCenter={() => setGuidedStep('settle')}
    />
  ) : (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
      <FileText size={32} className="opacity-30" />
      <p className="text-sm">{t.emptyReporting}</p>
    </div>
  )

  const settlePanel = hasData ? (
    <SettlementCenterPanel
      revenues={revenues}
      labelArtists={labelArtists}
      periodStart={detectedPeriodStart}
      periodEnd={detectedPeriodEnd}
      territoryMetrics={territoryMetrics}
      merchOrderRows={merchOrderRows}
      bronzeBatchIds={bronzeBatchIds}
      persistDisabled={isProcessing}
      onCreateDraft={handlePublishToPortal}
      onBuildCorrectionPdf={buildCorrectionPdfBase64}
    />
  ) : (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
      <SealCheck size={32} className="opacity-30" />
      <p className="text-sm">{t.emptySettlements}</p>
    </div>
  )

  const rulesStatusBanner = settingsReady ? (
    <p className="px-6 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-muted/10">
      {isWorkspaceSaving
        ? t.rulesWorkspaceSaving
        : isSettingsDirty
          ? t.rulesWorkspaceDirty
          : !currentPeriodKey
            ? `${t.rulesWorkspaceDefaultSynced}${defaultPresetLoadedAt ? ` · ${new Date(defaultPresetLoadedAt).toLocaleString()}` : ''}`
            : `${t.rulesWorkspaceSynced}${workspaceLoadedAt ? ` · ${new Date(workspaceLoadedAt).toLocaleString()}${workspaceUpdatedBy ? ` · ${workspaceUpdatedBy.slice(0, 8)}` : ''}` : ''}`}
    </p>
  ) : null

  const periodBanner = hasData && (detectedPeriodStart || detectedPeriodEnd) ? (
    <Alert className="mx-6 mt-4 border-primary/30 bg-primary/5">
      <FileText size={14} className="text-primary" />
      <AlertDescription className="text-xs">
        {t.detectedPeriod} <strong>{detectedPeriodStart}</strong>
        {detectedPeriodEnd && detectedPeriodEnd !== detectedPeriodStart && (
          <> – <strong>{detectedPeriodEnd}</strong></>
        )}
        {isProcessing && ` ${t.processing}`}
      </AlertDescription>
    </Alert>
  ) : null

  if (viewMode === 'guided') {
    if (wizardMode == null) {
      return (
        <div className="space-y-0">
          {rulesStatusBanner}
          <SosWizardModeChooser
            onSelect={(mode) => {
              setWizardMode(mode)
              setGuidedStep(mode === 'assistant' ? 'setup' : 'upload')
            }}
          />
        </div>
      )
    }

    const stepIds = wizardMode === 'assistant' ? ASSISTANT_WIZARD_STEP_IDS : QUICK_WIZARD_STEP_IDS

    return (
      <div className="space-y-0">
        {rulesStatusBanner}
        {periodBanner}
        {showPdfSettings && (
          <PdfExportSettingsPanel settings={pdfSettings} onUpdate={setPdfSettings} />
        )}
        <AccountingGuidedWizard
          hasData={hasData}
          isProcessing={isProcessing}
          activeStep={guidedStep}
          onActiveStepChange={setGuidedStep}
          onSwitchToAdvanced={() => setViewMode('advanced')}
          onImportReady={() => {
            toast.success('Import abgeschlossen', {
              description: 'CSV-Daten wurden verarbeitet. Prüfen Sie die Auszahlungen und klicken Sie auf Weiter.',
            })
          }}
          stepIds={stepIds}
          hasBlockingValidation={hasBlockingValidation}
          setupPanel={wizardMode === 'assistant' ? setupPanel : undefined}
          validatePanel={wizardMode === 'assistant' ? validatePanel : undefined}
          uploadPanel={uploadPanel}
          reviewPanel={reviewPanel}
          settlePanel={settlePanel}
          labels={{
            guidedSwitchAdvanced: t.guidedSwitchAdvanced,
            guidedStepUpload: t.guidedStepUpload,
            guidedStepUploadDesc: t.guidedStepUploadDesc,
            guidedStepReview: t.guidedStepReview,
            guidedStepReviewDesc: t.guidedStepReviewDesc,
            guidedStepSettle: t.guidedStepSettle,
            guidedStepSettleDesc: t.guidedStepSettleDesc,
            guidedBack: t.guidedBack,
            guidedNext: t.guidedNext,
            guidedOpenSettle: t.guidedOpenSettle,
            guidedProcessingHint: t.guidedProcessingHint,
            guidedUploadHint: t.guidedUploadHint,
            guidedReviewHint: t.guidedReviewHint,
            guidedSettleHint: t.guidedSettleHint,
            guidedStepperAria: t.guidedStepperAria,
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Sub-tab navigation */}
      <div
        className={cn('flex items-center gap-1 px-6 pt-4 border-b border-border', horizontalScrollClass)}
        data-lenis-prevent
        role="tablist"
        aria-label={t.subTabListLabel}
      >
        {subTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`accounting-subtab-${tab.id}`}
            aria-selected={activeSubTab === tab.id}
            aria-controls={`accounting-subtab-panel-${tab.id}`}
            tabIndex={activeSubTab === tab.id ? 0 : -1}
            onClick={() => setActiveSubTab(tab.id)}
            onKeyDown={(event) => handleSubTabKeyDown(event, tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'border border-b-0 border-border bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground mb-0.5"
          onClick={() => setViewMode('guided')}
        >
          <Sparkle size={13} aria-hidden="true" />
          {t.guidedSwitchGuided}
        </Button>

        {/* Presets sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground mb-0.5">
              <BookmarkSimple size={13} /> {t.presets}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-lenis-prevent>
            <SheetHeader>
              <SheetTitle>{t.presetsTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <CsvProfileManager
                artistMappings={artistMappings}
                compilationFilters={compilationFilters}
                splitFees={splitFees}
                manualRevenues={manualRevenues}
                expenses={expenses}
                ignoredEntries={ignoredEntries}
                csvAliases={csvAliases}
                trackRevenueAssignments={trackRevenueAssignments}
                appDefaults={appDefaults}
                emailConfig={emailConfig}
                labelInfo={labelBranding}
                pdfSettings={pdfSettings}
                csvImportProfiles={csvImportProfilesCustom}
                onLoad={handlePresetLoad}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* CSV import profiles */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground mb-0.5">
              <Table size={13} /> {t.csvProfiles}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-lenis-prevent>
            <SheetHeader>
              <SheetTitle>{t.csvProfilesTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <CsvImportProfileEditor
                profiles={csvImportProfiles}
                customProfiles={customProfiles}
                onSave={saveCsvProfile}
                onDelete={deleteCsvProfile}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Workspace sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground mb-0.5">
              <DownloadSimple size={13} /> {t.workspace}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-lenis-prevent>
            <SheetHeader>
              <SheetTitle>{t.workspaceTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <WorkspaceManager
                appDefaults={appDefaults}
                emailConfig={emailConfig}
                artistMappings={artistMappings}
                compilationFilters={compilationFilters}
                splitFees={splitFees}
                manualRevenues={manualRevenues}
                expenses={expenses}
                ignoredEntries={ignoredEntries}
                csvAliases={csvAliases}
                trackRevenueAssignments={trackRevenueAssignments}
                labelInfo={labelBranding}
                pdfSettings={pdfSettings}
                csvImportProfiles={csvImportProfilesCustom}
                onImport={handleWorkspaceImport}
              />
            </div>
          </SheetContent>
        </Sheet>

        <button
          onClick={() => setShowPdfSettings(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 pb-2"
        >
          {t.pdfSettings}
        </button>
      </div>

      {(activeSubTab === 'analytics' || activeSubTab === 'settlements') && (
        <p className="px-6 py-2 text-xs text-muted-foreground border-b border-border bg-muted/20">
          {activeSubTab === 'analytics' ? t.subTabAnalyticsHint : t.subTabSettlementsHint}
        </p>
      )}

      {periodBanner}

      {/* PDF Settings collapsible */}
      {showPdfSettings && (
        <PdfExportSettingsPanel settings={pdfSettings} onUpdate={setPdfSettings} />
      )}

      {rulesStatusBanner}

      {/* Sub-tab content */}
      <div className="min-h-[500px]">
        {activeSubTab === 'upload' && (
          <div
            id="accounting-subtab-panel-upload"
            role="tabpanel"
            aria-labelledby="accounting-subtab-upload"
          >
          <div className="p-6">
            <UniversalFileUploadZone
              believeManager={believeManager}
              bandcampManager={bandcampManager}
              shopifyManager={shopifyManager}
              printfulManager={printfulManager}
              darkmerchManager={darkmerchManager}
              csvProfiles={csvImportProfiles}
              onAddAliases={aliases => {
                aliases.forEach(alias => handleAddCsvAlias(alias))
              }}
            />
          </div>
          </div>
        )}

        {activeSubTab === 'reporting' && (
          <div
            id="accounting-subtab-panel-reporting"
            role="tabpanel"
            aria-labelledby="accounting-subtab-reporting"
          >
          {hasData ? (
            <ReportingPanel
              revenues={revenues}
              onDownloadPDF={handleDownloadPDF}
              onDownloadExcel={handleDownloadExcel}
              onDownloadAll={handleDownloadAll}
              onDownloadSelected={handleDownloadSelected}
              labelArtists={labelArtists}
              labelInfo={labelInfo}
              appDefaults={appDefaults}
              periodStart={detectedPeriodStart}
              periodEnd={detectedPeriodEnd}
              onGoToSettlementCenter={() => setActiveSubTab('settlements')}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm">{t.emptyReporting}</p>
            </div>
          )}
          </div>
        )}

        {activeSubTab === 'settlements' && (
          <div
            id="accounting-subtab-panel-settlements"
            role="tabpanel"
            aria-labelledby="accounting-subtab-settlements"
          >
          {hasData ? (
            <SettlementCenterPanel
              revenues={revenues}
              labelArtists={labelArtists}
              periodStart={detectedPeriodStart}
              periodEnd={detectedPeriodEnd}
              territoryMetrics={territoryMetrics}
              merchOrderRows={merchOrderRows}
              bronzeBatchIds={bronzeBatchIds}
              persistDisabled={isProcessing}
              onCreateDraft={handlePublishToPortal}
              onBuildCorrectionPdf={buildCorrectionPdfBase64}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <SealCheck size={32} className="opacity-30" />
              <p className="text-sm">{t.emptySettlements}</p>
            </div>
          )}
          </div>
        )}

        {activeSubTab === 'analytics' && (
          <div
            id="accounting-subtab-panel-analytics"
            role="tabpanel"
            aria-labelledby="accounting-subtab-analytics"
            className="p-6 space-y-6"
          >
            <section className="space-y-4" aria-labelledby="analytics-ops-heading">
              <h3 id="analytics-ops-heading" className="text-sm font-semibold text-foreground">
                {t.analyticsOpsHeading}
              </h3>

              {/* Enterprise collaborative workspace controls */}
              <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/10 p-2 text-xs">
                <span className="font-medium text-foreground">{t.workspaceServer ?? 'Workspace (server):'}</span>
                {currentPeriodKey ? (
                  workspaceLoadedAt ? (
                    <span className="text-muted-foreground">
                      {t.workspaceLastSaved ?? 'last saved'} {new Date(workspaceLoadedAt).toLocaleString()} {workspaceUpdatedBy ? `· ${workspaceUpdatedBy.slice(0, 8)}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t.workspaceNotSaved ?? 'not yet saved for this period'}</span>
                  )
                ) : defaultPresetLoadedAt ? (
                  <span className="text-muted-foreground">
                    {t.workspaceDefaultSaved ?? 'Default preset saved'} {new Date(defaultPresetLoadedAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.workspaceDefaultNotSaved ?? 'Default preset not saved yet'}</span>
                )}
                <button
                  type="button"
                  onClick={() => void loadFromServer()}
                  disabled={isWorkspaceLoading || isProcessing}
                  className="rounded border px-2 py-0.5 hover:bg-background disabled:opacity-50"
                >
                  {isWorkspaceLoading ? (t.workspaceLoading ?? 'Loading…') : (t.workspaceReload ?? 'Reload from server')}
                </button>
                <button
                  type="button"
                  onClick={() => void saveCurrentWorkspace()}
                  disabled={isWorkspaceSaving || isProcessing}
                  className="rounded bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isWorkspaceSaving
                    ? (t.workspaceSaving ?? 'Saving…')
                    : currentPeriodKey
                      ? (t.workspaceSave ?? 'Save workspace to server')
                      : (t.workspaceSaveDefault ?? 'Save default preset')}
                </button>
                {currentPeriodKey && (
                  <button
                    type="button"
                    disabled={isWorkspaceLoading || isProcessing || workspaceDeleting}
                    onClick={() => setWorkspaceDeleteOpen(true)}
                    className="rounded border border-destructive/40 px-2 py-0.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Workspace löschen
                  </button>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {currentPeriodKey
                    ? (t.workspaceSharedHint ?? 'Shared across team · period-keyed')
                    : (t.workspaceDefaultHint ?? 'Shared default settings until a period is detected')}
                </span>
              </div>

              <OperatorPlaybook
                title={t.playbookTitle}
                step1={t.playbookStep1}
                step2={t.playbookStep2}
                step3={t.playbookStep3}
              />
              <ImportBatchesPanel labelArtists={labelArtists} onLoadBatch={loadBronzeBatch} />
              <ExternalMetricsSyncPanel />
              {hasData ? (
                <SosAnalyticsPersistPanel
                  periodStart={detectedPeriodStart}
                  periodEnd={detectedPeriodEnd}
                  territoryMetrics={territoryMetrics}
                  merchOrderRows={merchOrderRows}
                  labelArtists={labelArtists}
                  revenues={revenues}
                  bronzeBatchIds={bronzeBatchIds}
                  disabled={isProcessing}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3 border border-dashed border-border rounded-lg">
                  <ChartBar size={32} className="opacity-30" />
                  <p className="text-sm">{t.emptyAnalytics}</p>
                </div>
              )}
            </section>

            {hasData && (
              <section className="space-y-4" aria-labelledby="analytics-preview-heading">
                <div className="space-y-2">
                  <h3 id="analytics-preview-heading" className="text-sm font-semibold text-foreground">
                    {t.analyticsPreviewHeading}
                  </h3>
                  <Alert className="border-amber-500/30 bg-amber-500/5">
                    <ChartBar size={14} className="text-amber-600" />
                    <AlertDescription className="text-xs">{t.analyticsSessionBanner}</AlertDescription>
                  </Alert>
                </div>
                <AdminEnterpriseAnalytics
                  revenues={revenues}
                  periodStart={detectedPeriodStart}
                  periodEnd={detectedPeriodEnd}
                />
              </section>
            )}
          </div>
        )}

        {activeSubTab === 'payout' && (
          <div
            id="accounting-subtab-panel-payout"
            role="tabpanel"
            aria-labelledby="accounting-subtab-payout"
          >
          {hasData ? (
            <PayoutManager
              labelArtists={labelArtists}
              labelInfo={labelInfo}
              periodStart={detectedPeriodStart}
              periodEnd={detectedPeriodEnd}
              onLabelSepaUpdate={handleLabelSepaUpdate}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Bank size={32} className="opacity-30" />
              <p className="text-sm">{t.emptyPayout}</p>
            </div>
          )}
          </div>
        )}

        {activeSubTab === 'trends' && (
          <div
            id="accounting-subtab-panel-trends"
            role="tabpanel"
            aria-labelledby="accounting-subtab-trends"
          >
          <TrendsDashboard
            revenues={revenues}
            periodStart={detectedPeriodStart}
            periodEnd={detectedPeriodEnd}
            bronzeBatchIds={bronzeBatchIds}
          />
          </div>
        )}

        {activeSubTab === 'rules' && (
          <div
            id="accounting-subtab-panel-rules"
            role="tabpanel"
            aria-labelledby="accounting-subtab-rules"
          >
          <RulesPanel
            artistMappings={artistMappings}
            compilationFilters={compilationFilters}
            splitFees={splitFees}
            manualRevenues={manualRevenues}
            expenses={expenses}
            ignoredEntries={ignoredEntries}
            csvAliases={csvAliases}
            trackRevenueAssignments={trackRevenueAssignments}
            appDefaults={appDefaults}
            emailConfig={emailConfig}
            onAddArtistMapping={handleAddMapping}
            onRemoveArtistMapping={handleRemoveMapping}
            onUpdateArtistMapping={handleUpdateMapping}
            onAddCompilationFilter={handleAddFilter}
            onRemoveCompilationFilter={handleRemoveFilter}
            onAddSplitFee={handleAddSplitFee}
            onRemoveSplitFee={handleRemoveSplitFee}
            onUpdateSplitFee={handleUpdateSplitFee}
            onAddManualRevenue={handleAddRevenue}
            onRemoveManualRevenue={handleRemoveRevenue}
            onUpdateManualRevenue={handleUpdateRevenue}
            onAddExpense={handleAddExpense}
            onRemoveExpense={handleRemoveExpense}
            onUpdateExpense={handleUpdateExpense}
            onAddIgnoredEntry={handleAddIgnoredEntry}
            onRemoveIgnoredEntry={handleRemoveIgnoredEntry}
            onAddCsvAlias={handleAddCsvAlias}
            onRemoveCsvAlias={handleRemoveCsvAlias}
            onAddTrackAssignment={handleAddTrackAssignment}
            onRemoveTrackAssignment={handleRemoveTrackAssignment}
            onUpdateAppDefaults={setAppDefaults}
            onUpdateEmailConfig={setEmailConfig}
            availableArtists={uniqueArtists ?? []}
            availableReleases={allReleaseTitles}
          />
          </div>
        )}
      </div>

      <SosConfirmDialog
        open={reloadConfirmOpen}
        onOpenChange={setReloadConfirmOpen}
        title={t.workspaceReloadConfirmTitle ?? 'Reload from server?'}
        description={t.workspaceReloadConfirmBody ?? 'Unsaved changes in this browser will be replaced by the server copy.'}
        confirmLabel={t.workspaceReloadConfirm ?? t.workspaceReload ?? 'Reload'}
        cancelLabel="Cancel"
        loading={isWorkspaceLoading}
        onConfirm={() => void confirmReloadFromServer()}
      />

      <SosConfirmDialog
        open={workspaceDeleteOpen}
        onOpenChange={setWorkspaceDeleteOpen}
        title="Workspace löschen"
        description={
          currentPeriodKey
            ? `Workspace für ${currentPeriodKey.start} – ${currentPeriodKey.end} vom Server löschen?`
            : ''
        }
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        destructive
        loading={workspaceDeleting}
        onConfirm={confirmWorkspaceDelete}
      />
    </div>
  )
}

export function AccountingPanel() {
  const t = useAccountingLabels()

  return (
    <Tabs defaultValue="generate" className="flex flex-col h-full">
      <div className="border-b border-border px-6 pt-4">
        <TabsList className="h-9">
          <TabsTrigger value="generate" className="gap-1.5 text-xs">
            <Wallet size={14} />
            {t.tabGenerate}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <ClockCounterClockwise size={14} />
            {t.tabHistory}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="generate" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
        <Suspense fallback={<Skeleton className="h-96 w-full m-6" />}>
          <SosGeneratorPanel />
        </Suspense>
      </TabsContent>

      <TabsContent value="history" className="flex-1 mt-0 p-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <StatementsManager readOnly settlementHref="/admin/accounting?guidedStep=settle" />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
