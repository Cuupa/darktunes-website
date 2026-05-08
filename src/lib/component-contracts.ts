/**
 * Component contracts for the darkTunes Music Group platform.
 *
 * These interfaces enforce Inversion of Control (IoC) across the component tree:
 * - UI sections receive all data and callbacks as props (no direct context reads).
 * - Admin sub-forms receive their data slice via AdminPanelProps<T>.
 * - All modals/dialogs are controlled externally via DialogProps.
 */

/**
 * Record of label keys to their display strings.
 * Allows CMS-style inline editing of section copy without touching code.
 */
export type SectionLabels = Record<string, string>

/**
 * Base contract for every page section.
 * All top-level page sections MUST extend this interface.
 */
export interface SectionProps {
  /** When true the section renders edit controls for inline label editing. */
  editMode?: boolean
  /** Key→value map of display labels that can be overridden at runtime. */
  sectionLabels?: SectionLabels
  /** Callback fired when the user edits a label in edit mode. */
  onLabelChange?: (key: string, value: string) => void
}

/**
 * Extends SectionProps with strongly-typed section data.
 * Use for data-driven sections (Releases, Artists, News, Videos, …).
 */
export interface EditableSectionProps<T> extends SectionProps {
  data: T
}

/**
 * Contract for every admin panel sub-form.
 * Sub-forms must NOT import AdminSettings directly – they receive their slice via this prop.
 */
export interface AdminPanelProps<T> {
  /** The data slice the sub-form manages (e.g. a single Artist or NewsPost). */
  value: T
  /** Called when the user saves changes; receives the updated value. */
  onChange: (updated: T) => void
  /** Optional loading state to disable form controls during async operations. */
  isLoading?: boolean
}

/**
 * Contract for all modal/dialog components.
 * Dialogs must NOT manage their own open/close state internally.
 */
export interface DialogProps {
  /** Controls whether the dialog is visible. */
  open: boolean
  /** Callback to close the dialog. */
  onClose: () => void
}
