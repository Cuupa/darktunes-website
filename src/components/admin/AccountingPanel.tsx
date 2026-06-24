'use client'

/**
 * src/components/admin/AccountingPanel.tsx
 *
 * Two-tab accounting panel:
 *  Tab A — "Generate Statements": full SOS Generator workflow embedded in admin.
 *           Artists come from useArtists() (no CSV roster upload needed).
 *  Tab B — "Statement History": read-only view of uploaded PDFs (StatementsManager).
 */

import { lazy, Suspense, useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { monthToPeriodDate } from '@/lib/sos/lineItemsFromArtistData'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { EMPTY_SOS_RULES_BUNDLE, type SosRulesBundle } from '@/lib/sos/sosRulesBundle'
import { useKV } from '@/hooks/useLocalKV'
import { UniversalFileUploadZone } from '@/components/admin/sos/UniversalFileUploadZone'
import { ReportingPanel } from '@/components/admin/sos/ReportingPanel'
import { SettlementCenterPanel } from '@/components/admin/sos/SettlementCenterPanel'
import { PayoutManager } from '@/components/admin/sos/PayoutManager'
import { PdfExportSettingsPanel } from '@/components/admin/sos/PdfExportSettingsPanel'
import { RulesPanel } from '@/components/admin/sos/RulesPanel'
import { SosAnalyticsPersistPanel } from '@/components/admin/sos/SosAnalyticsPersistPanel'
import { OperatorPlaybook } from '@/components/admin/sos/OperatorPlaybook'
import { ImportBatchesPanel } from '@/components/admin/sos/ImportBatchesPanel'
import { ExternalMetricsSyncPanel } from '@/components/admin/sos/ExternalMetricsSyncPanel'
import dynamic from 'next/dynamic'
const TrendsDashboard = dynamic(() => import('@/components/admin/sos/TrendsDashboard').then(mod => mod.TrendsDashboard), { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> })
import { CsvProfileManager } from '@/components/admin/sos/CsvProfileManager'
import { CsvImportProfileEditor } from '@/components/admin/sos/CsvImportProfileEditor'
import { AdminEnterpriseAnalytics } from '@/components/admin/sos/AdminEnterpriseAnalytics'
import { useCsvImportProfiles } from '@/hooks/useCsvImportProfiles'
import { WorkspaceManager } from '@/components/admin/sos/WorkspaceManager'
import {
  Wallet, ClockCounterClockwise, FileText, Bank, Sliders,
  ChartBar, TrendUp, BookmarkSimple, DownloadSimple, Table, SealCheck,
} from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { v4 as uuidv4 } from 'uuid'
import { useDict } from '@/contexts/DictContext'

const StatementsManager = lazy(
  () => import('@/components/admin/StatementsManager').then(m => ({ default: m.StatementsManager }))
)

type SubTab = 'upload' | 'reporting' | 'settlements' | 'analytics' | 'payout' | 'rules' | 'trends'

const ACCOUNTING_FALLBACK = {
  pageTitle: 'Accounting',
  pageDescription: 'Generate royalty statements for artists and review statement history.',
  tabGenerate: 'Generate Statements',
  tabHistory: 'Statement History',
  subTabUpload: 'Upload',
  subTabReporting: 'Reporting',
  subTabSettlements: 'Settlement Center',
  subTabAnalytics: 'Portal Data',
  subTabAnalyticsHint:
    'Bronze archives, listener sync, and Save to Portal — data artists will see after you persist it.',
  subTabSettlementsHint:
    'Create draft statements, approve them, track invoices, and record payments.',
  subTabPayout: 'SEPA Payout',
  subTabTrends: 'Trends',
  subTabRules: 'Rules',
  presets: 'Presets',
  presetsTitle: 'Rule Presets',
  csvProfiles: 'CSV Profiles',
  csvProfilesTitle: 'CSV Import Profiles',
  workspace: 'Workspace',
  workspaceTitle: 'Workspace Import / Export',
  pdfSettings: 'PDF Settings',
  detectedPeriod: 'Detected period:',
  processing: '(processing…)',
  emptyReporting: 'Upload CSV files first to see reporting data.',
  emptySettlements: 'Upload CSV files first to open the settlement center.',
  emptyAnalytics: 'Upload CSV files first to see analytics.',
  emptyPayout: 'Upload CSV files first to calculate payouts.',
  analyticsOpsHeading: 'Portal data & operations',
  analyticsPreviewHeading: 'Session preview (not in portal)',
  analyticsSessionBanner:
    'Charts below use in-memory CSV data. Artists only see metrics after you click Save to Portal.',
  playbookTitle: 'Operator playbook',
  playbookStep1: 'Upload CSV files and approve statements in Settlement Center.',
  playbookStep2: 'Click Save to Portal below to persist territory metrics for linked artists.',
  playbookStep3: 'Review saved trends and roster health in Label Intelligence.',
  subTabListLabel: 'Accounting workflow sections',
  rulesLocalBanner: 'Rules are saved locally in this browser (IndexedDB).',
} as const

const SUB_TAB_IDS: SubTab[] = ['upload', 'reporting', 'settlements', 'analytics', 'payout', 'trends', 'rules']

function isSubTab(value: string | null): value is SubTab {
  return value != null && (SUB_TAB_IDS as string[]).includes(value)
}

function SosGeneratorPanel() {
  const dict = useDict()
  const searchParams = useSearchParams()
  const t = dict.admin?.accounting ?? ACCOUNTING_FALLBACK
  const { artists } = useArtists()
  const { settings } = useSiteSettings()
  const {
    profiles: csvImportProfiles,
    customProfiles,
    saveProfile: saveCsvProfile,
    deleteProfile: deleteCsvProfile,
  } = useCsvImportProfiles()

  // Map portal artists to SOS LabelArtist[]
  const labelArtists = useMemo(() => mapArtistsToLabelArtists(artists), [artists])

  const [labelBranding, setLabelBranding] = useKV<LabelInfo>('sos-label-info', DEFAULT_LABEL_INFO)

  // Site settings override public branding fields; SEPA/bank details persist in IndexedDB.
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
    [setLabelBranding],
  )

  // PDF settings state
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>(DEFAULT_PDF_EXPORT_SETTINGS)
  const [appDefaults, setAppDefaults] = useState<AppDefaults>(DEFAULT_APP_DEFAULTS)
  const [emailConfig, setEmailConfig] = useState<Partial<EmailConfig>>(DEFAULT_EMAIL_CONFIG)
  const [showPdfSettings, setShowPdfSettings] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('upload')

  useEffect(() => {
    const subTab = searchParams.get('subTab')
    if (isSubTab(subTab)) setActiveSubTab(subTab)
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

  const [savedRules, setSavedRules, , rulesLoaded] = useKV<SosRulesBundle>(
    'sos-rules-state',
    EMPTY_SOS_RULES_BUNDLE,
  )
  const rulesHydratedRef = useRef(false)

  useEffect(() => {
    if (!rulesLoaded || rulesHydratedRef.current) return
    rulesHydratedRef.current = true
    const bundle = savedRules ?? EMPTY_SOS_RULES_BUNDLE
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
  }, [rulesLoaded, savedRules])

  useEffect(() => {
    if (!rulesHydratedRef.current) return
    setSavedRules({
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
    })
  }, [
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
    setSavedRules,
  ])

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

  // Workspace import (replaces all rules at once)
  const handleWorkspaceImport = useCallback((bundle: {
    appDefaults: AppDefaults
    emailConfig: Partial<EmailConfig>
    artistMappings: ArtistMapping[]
    compilationFilters: CompilationFilter[]
    splitFees: SplitFee[]
    manualRevenues: ManualRevenue[]
    expenses: ExpenseEntry[]
    ignoredEntries: IgnoredEntry[]
    csvAliases: CSVColumnAlias[]
    trackRevenueAssignments: TrackRevenueAssignment[]
  }) => {
    setAppDefaults(bundle.appDefaults)
    setEmailConfig(bundle.emailConfig)
    setArtistMappings(bundle.artistMappings)
    setCompilationFilters(bundle.compilationFilters)
    setSplitFees(bundle.splitFees)
    setManualRevenues(bundle.manualRevenues)
    setExpenses(bundle.expenses)
    setIgnoredEntries(bundle.ignoredEntries)
    setCsvAliases(bundle.csvAliases)
    setTrackRevenueAssignments(bundle.trackRevenueAssignments)
  }, [])

  // Preset load (also replaces all rules)
  const handlePresetLoad = useCallback((preset: {
    appDefaults: AppDefaults
    emailConfig: Partial<EmailConfig>
    artistMappings: ArtistMapping[]
    compilationFilters: CompilationFilter[]
    splitFees: SplitFee[]
    manualRevenues: ManualRevenue[]
    expenses: ExpenseEntry[]
    ignoredEntries: IgnoredEntry[]
    csvAliases: CSVColumnAlias[]
    trackRevenueAssignments?: TrackRevenueAssignment[]
  }) => {
    setAppDefaults(preset.appDefaults)
    setEmailConfig(preset.emailConfig)
    setArtistMappings(preset.artistMappings)
    setCompilationFilters(preset.compilationFilters)
    setSplitFees(preset.splitFees)
    setManualRevenues(preset.manualRevenues)
    setExpenses(preset.expenses)
    setIgnoredEntries(preset.ignoredEntries)
    setCsvAliases(preset.csvAliases)
    if (preset.trackRevenueAssignments) {
      setTrackRevenueAssignments(preset.trackRevenueAssignments)
    }
  }, [])

  // File managers for each source
  const believeManager   = useFileManager('believe')
  const bandcampManager  = useFileManager('bandcamp')
  const shopifyManager   = useFileManager('shopify')
  const printfulManager  = useFileManager('printful')
  const darkmerchManager = useFileManager('darkmerch')
  const [carryForwardByArtist, setCarryForwardByArtist] = useState<Record<string, number>>({})

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

  const { handleDownloadPDF, handleDownloadExcel, handleDownloadAll, handleDownloadSelected, handlePublishToPortal } =
    useExports(
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

  return (
    <div className="space-y-0">
      {/* Sub-tab navigation */}
      <div
        className="flex items-center gap-1 px-6 pt-4 border-b border-border overflow-x-auto"
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
                appDefaults={appDefaults}
                emailConfig={emailConfig}
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

      {/* Period info banner */}
      {hasData && (detectedPeriodStart || detectedPeriodEnd) && (
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
      )}

      {/* PDF Settings collapsible */}
      {showPdfSettings && (
        <PdfExportSettingsPanel settings={pdfSettings} onUpdate={setPdfSettings} />
      )}

      {rulesLoaded && (
        <p className="px-6 py-1.5 text-[11px] text-muted-foreground border-b border-border bg-muted/10">
          {t.rulesLocalBanner}
        </p>
      )}

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
          hasData ? (
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
          )
        )}

        {activeSubTab === 'settlements' && (
          hasData ? (
            <SettlementCenterPanel
              revenues={revenues}
              labelArtists={labelArtists}
              periodStart={detectedPeriodStart}
              periodEnd={detectedPeriodEnd}
              onCreateDraft={handlePublishToPortal}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <SealCheck size={32} className="opacity-30" />
              <p className="text-sm">{t.emptySettlements}</p>
            </div>
          )
        )}

        {activeSubTab === 'analytics' && (
          <div className="p-6 space-y-6">
            <section className="space-y-4" aria-labelledby="analytics-ops-heading">
              <h3 id="analytics-ops-heading" className="text-sm font-semibold text-foreground">
                {t.analyticsOpsHeading}
              </h3>
              <OperatorPlaybook
                title={t.playbookTitle}
                step1={t.playbookStep1}
                step2={t.playbookStep2}
                step3={t.playbookStep3}
              />
              <ImportBatchesPanel labelArtists={labelArtists} />
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
          hasData ? (
            <PayoutManager
              revenues={revenues}
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
          )
        )}

        {activeSubTab === 'trends' && (
          <TrendsDashboard
            revenues={revenues}
            periodStart={detectedPeriodStart}
            periodEnd={detectedPeriodEnd}
            bronzeBatchIds={bronzeBatchIds}
          />
        )}

        {activeSubTab === 'rules' && (
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
        )}
      </div>
    </div>
  )
}

export function AccountingPanel() {
  const dict = useDict()
  const t = dict.admin?.accounting ?? ACCOUNTING_FALLBACK

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
          <StatementsManager readOnly settlementHref="/admin/accounting?subTab=settlements" />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
