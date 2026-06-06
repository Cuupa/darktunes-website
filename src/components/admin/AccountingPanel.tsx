'use client'

/**
 * src/components/admin/AccountingPanel.tsx
 *
 * Two-tab accounting panel:
 *  Tab A — "Generate Statements": full SOS Generator workflow embedded in admin.
 *           Artists come from useArtists() (no CSV roster upload needed).
 *  Tab B — "Statement History": read-only view of uploaded PDFs (StatementsManager).
 */

import { lazy, Suspense, useState, useMemo, useCallback } from 'react'
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
} from '@/lib/sos/types'
import { DEFAULT_PDF_EXPORT_SETTINGS, DEFAULT_APP_DEFAULTS } from '@/lib/sos/defaults'
import { UniversalFileUploadZone } from '@/components/admin/sos/UniversalFileUploadZone'
import { ReportingPanel } from '@/components/admin/sos/ReportingPanel'
import { PayoutManager } from '@/components/admin/sos/PayoutManager'
import { PdfExportSettingsPanel } from '@/components/admin/sos/PdfExportSettingsPanel'
import { RulesPanel } from '@/components/admin/sos/RulesPanel'
import { Wallet, ClockCounterClockwise, FileText, Bank, Sliders } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { v4 as uuidv4 } from 'uuid'

const StatementsManager = lazy(
  () => import('@/components/admin/StatementsManager').then(m => ({ default: m.StatementsManager }))
)

function SosGeneratorPanel() {
  const { artists } = useArtists()
  const { settings } = useSiteSettings()

  // Map portal artists to SOS LabelArtist[]
  const labelArtists = useMemo(() => mapArtistsToLabelArtists(artists), [artists])

  // Map SiteSettings to LabelInfo
  const labelInfo = useMemo<LabelInfo>(() => ({
    name:    settings.labelName    ?? 'darkTunes',
    address: settings.impressumAddress ?? '',
    taxId:   settings.impressumVatId   ?? '',
  }), [settings])

  // PDF settings state
  const [pdfSettings, setPdfSettings] = useState<PdfExportSettings>(DEFAULT_PDF_EXPORT_SETTINGS)
  const [appDefaults] = useState<AppDefaults>(DEFAULT_APP_DEFAULTS)
  const [showPdfSettings, setShowPdfSettings] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'reporting' | 'payout' | 'rules'>('upload')

  // Rules state
  const [artistMappings, setArtistMappings] = useState<ArtistMapping[]>([])
  const [compilationFilters, setCompilationFilters] = useState<CompilationFilter[]>([])
  const [splitFees, setSplitFees] = useState<SplitFee[]>([])
  const [manualRevenues, setManualRevenues] = useState<ManualRevenue[]>([])
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([])
  const [ignoredEntries, setIgnoredEntries] = useState<IgnoredEntry[]>([])

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

  // File managers for each source
  const believeManager  = useFileManager('believe')
  const bandcampManager = useFileManager('bandcamp')
  const shopifyManager  = useFileManager('shopify')
  const printfulManager = useFileManager('printful')
  const darkmerchManager = useFileManager('darkmerch')

  // CSV processing
  const {
    isProcessing,
    revenues,
    processedData,
    detectedPeriodStart,
    detectedPeriodEnd,
    uniqueArtists,
    releaseTitlesByArtistIncFeaturing,
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
      csvAliases: [],
      labelArtists,
      ignoredEntries,
      distributionFeePercentage: appDefaults.distributionFeePercentage ?? 0,
    },
    shopifyManager.files,
    printfulManager.files,
    darkmerchManager.files,
  )

  // Derive flat list of all release titles across all artists for IgnoredEntriesManager
  const allReleaseTitles = useMemo(() => {
    const titles = new Set<string>()
    for (const releases of Object.values(releaseTitlesByArtistIncFeaturing ?? {})) {
      for (const t of releases) titles.add(t)
    }
    return Array.from(titles).sort()
  }, [releaseTitlesByArtistIncFeaturing])

  // Export handlers (PDF/Excel/ZIP + portal upload)
  const { handleDownloadPDF, handleDownloadExcel, handleDownloadAll, handleDownloadSelected } =
    useExports(
      processedData,
      labelInfo,
      detectedPeriodStart,
      detectedPeriodEnd,
      pdfSettings,
      appDefaults,
      labelArtists,
    )

  const hasData = revenues.length > 0

  const rulesCount = artistMappings.length + compilationFilters.length + splitFees.length +
    manualRevenues.length + expenses.length + ignoredEntries.length

  return (
    <div className="space-y-0">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-border">
        {(['upload', 'reporting', 'payout', 'rules'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
              activeSubTab === tab
                ? 'border border-b-0 border-border bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'upload' && 'Upload'}
            {tab === 'reporting' && 'Reporting'}
            {tab === 'payout' && 'SEPA Payout'}
            {tab === 'rules' && (
              <>
                <Sliders size={14} />
                Rules
                {rulesCount > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                    {rulesCount}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowPdfSettings(v => !v)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 pb-2"
        >
          PDF Settings
        </button>
      </div>

      {/* Period info banner */}
      {hasData && (detectedPeriodStart || detectedPeriodEnd) && (
        <Alert className="mx-6 mt-4 border-primary/30 bg-primary/5">
          <FileText size={14} className="text-primary" />
          <AlertDescription className="text-xs">
            Detected period: <strong>{detectedPeriodStart}</strong>
            {detectedPeriodEnd && detectedPeriodEnd !== detectedPeriodStart && (
              <> – <strong>{detectedPeriodEnd}</strong></>
            )}
            {isProcessing && ' (processing…)'}
          </AlertDescription>
        </Alert>
      )}

      {/* PDF Settings collapsible */}
      {showPdfSettings && (
        <PdfExportSettingsPanel settings={pdfSettings} onUpdate={setPdfSettings} />
      )}

      {/* Sub-tab content */}
      <div className="min-h-[500px]">
        {activeSubTab === 'upload' && (
          <div className="p-6">
            <UniversalFileUploadZone
              believeManager={believeManager}
              bandcampManager={bandcampManager}
              shopifyManager={shopifyManager}
              printfulManager={printfulManager}
              darkmerchManager={darkmerchManager}
              onAddAliases={() => {}}
            />
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
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm">Upload CSV files first to see reporting data.</p>
            </div>
          )
        )}

        {activeSubTab === 'payout' && (
          hasData ? (
            <PayoutManager
              revenues={revenues}
              labelArtists={labelArtists}
              labelInfo={labelInfo}
              periodStart={detectedPeriodStart}
              periodEnd={detectedPeriodEnd}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <Bank size={32} className="opacity-30" />
              <p className="text-sm">Upload CSV files first to calculate payouts.</p>
            </div>
          )
        )}

        {activeSubTab === 'rules' && (
          <RulesPanel
            artistMappings={artistMappings}
            compilationFilters={compilationFilters}
            splitFees={splitFees}
            manualRevenues={manualRevenues}
            expenses={expenses}
            ignoredEntries={ignoredEntries}
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
            availableArtists={uniqueArtists ?? []}
            availableReleases={allReleaseTitles}
          />
        )}
      </div>
    </div>
  )
}

export function AccountingPanel() {
  return (
    <Tabs defaultValue="generate" className="flex flex-col h-full">
      <div className="border-b border-border px-6 pt-4">
        <TabsList className="h-9">
          <TabsTrigger value="generate" className="gap-1.5 text-xs">
            <Wallet size={14} />
            Generate Statements
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <ClockCounterClockwise size={14} />
            Statement History
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="generate" className="flex-1 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
        <SosGeneratorPanel />
      </TabsContent>

      <TabsContent value="history" className="flex-1 mt-0 p-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <StatementsManager />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
