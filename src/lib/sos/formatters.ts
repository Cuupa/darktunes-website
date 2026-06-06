/** Formats a number as a Euro currency string with 2 decimal places (de-DE locale). */
export const fmtEur = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtCurrencyEur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

export const fmtPct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : '0.0'

export const totalDeductions = (rev: { distributionFeeDeducted: number; totalExpenses: number }) =>
  rev.distributionFeeDeducted + rev.totalExpenses
