export type ClientSseEvent =
  | { type: 'status'; state: string }
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; tool_name: string }
  | { type: 'tool_result'; tool_name: string; ok: boolean }
  | { type: 'usage'; input_tokens: number; output_tokens: number; reasoning_tokens: number; total_tokens: number }
  | { type: 'error'; code: string; detail: string }
  | { type: 'done'; model: string }

export function encodeSse(event: ClientSseEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}
