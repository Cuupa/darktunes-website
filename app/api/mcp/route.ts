/** Compatibility alias. All authorization and tool execution happen at /mcp. */
export { POST, GET, DELETE } from '../../mcp/route'

// Segment config must be literal (it cannot be re-exported) and must match app/mcp/route.ts.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30
