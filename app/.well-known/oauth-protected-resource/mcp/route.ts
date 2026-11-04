/** Path-scoped discovery for clients using the original /mcp endpoint. */
export { GET, OPTIONS } from '../route'

// Segment config must be literal (it cannot be re-exported) and must match ../route.ts.
export const dynamic = 'force-dynamic'
