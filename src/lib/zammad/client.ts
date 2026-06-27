/**
 * src/lib/zammad/client.ts
 *
 * Low-level HTTP client for the Zammad REST API.
 * https://docs.zammad.org/en/latest/api/ticket/index.html
 */

import type { ZammadConfig } from './config'

export interface CreateZammadTicketInput {
  title: string
  group: string
  customerEmail: string
  articleSubject: string
  articleBody: string
}

export interface CreateZammadTicketResult {
  ticketId: number
}

export async function createZammadTicket(
  config: ZammadConfig,
  input: CreateZammadTicketInput,
): Promise<CreateZammadTicketResult> {
  const url = `${config.baseUrl}/api/v1/tickets`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token token=${config.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      group: input.group,
      customer_id: `guess:${input.customerEmail}`,
      article: {
        subject: input.articleSubject,
        body: input.articleBody,
        type: 'note',
        internal: false,
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Zammad API ${response.status}: ${body.slice(0, 500)}`)
  }

  const data = (await response.json()) as { id?: number }
  if (typeof data.id !== 'number') {
    throw new Error('Zammad API returned no ticket id')
  }

  return { ticketId: data.id }
}