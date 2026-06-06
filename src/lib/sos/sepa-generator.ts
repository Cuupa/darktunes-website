/**
 * sepa-generator.ts
 *
 * Pure, deterministic generator for SEPA Credit Transfer Initiation messages
 * in the ISO 20022 `pain.001.001.03` XML format (used for batch wire transfers
 * in the SEPA payment area).
 *
 * Ported from sos-generator-for-mu — no changes from upstream.
 */

/** A single recipient artist in a SEPA batch payout. */
export interface SepaPayoutEntry {
  accountHolder: string
  iban: string
  bic?: string
  amount: number
  endToEndId?: string
}

/** Label (debitor) configuration required by the SEPA XML header. */
export interface SepaLabelConfig {
  accountHolder: string
  iban: string
  bic?: string
  periodLabel: string
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return rounded.toFixed(2)
}

function todayIso(): string {
  const now = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day   = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function creationDateTime(): string {
  const now = new Date()
  const date = todayIso()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${date}T${hh}:${mm}:${ss}`
}

function generateMsgId(): string {
  const dateStamp = todayIso().replace(/-/g, '')
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `SEPA-${dateStamp}-${random}`
}

const BIC_FALLBACK_VALUE = 'NOTPROVIDED'
const USTRD_MAX_LENGTH = 140

export function generateSepaXml(
  payouts: SepaPayoutEntry[],
  labelConfig: SepaLabelConfig
): string {
  if (payouts.length === 0) {
    throw new Error('SEPA XML generation requires at least one valid payout entry.')
  }

  const msgId         = generateMsgId()
  const creDtTm       = creationDateTime()
  const reqExctnDt    = todayIso()
  const nbOfTxs       = payouts.length
  const ctrlSum       = formatAmount(payouts.reduce((acc, p) => acc + p.amount, 0))
  const pmtInfId      = `PMTINF-${msgId}`
  const labelName     = escapeXml(labelConfig.accountHolder)
  const labelIban     = escapeXml(labelConfig.iban)
  const periodLabel   = escapeXml(labelConfig.periodLabel)
  const ustrdBase     = `Abrechnung ${periodLabel} ${escapeXml(labelConfig.accountHolder)}`
  const ustrdTruncated = ustrdBase.length > USTRD_MAX_LENGTH ? ustrdBase.slice(0, USTRD_MAX_LENGTH) : ustrdBase

  const dbtrAgtBlock = labelConfig.bic
    ? `      <DbtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(labelConfig.bic)}</BIC>
        </FinInstnId>
      </DbtrAgt>`
    : `      <DbtrAgt>
        <FinInstnId>
          <Othr>
            <Id>${BIC_FALLBACK_VALUE}</Id>
          </Othr>
        </FinInstnId>
      </DbtrAgt>`

  const transactions = payouts.map((payout, index) => {
    const endToEndId = payout.endToEndId ?? `E2E-${String(index + 1).padStart(4, '0')}`
    const cdtrName = escapeXml(payout.accountHolder)
    const cdtrIban = escapeXml(payout.iban)
    const instdAmt = formatAmount(payout.amount)

    const cdtrAgtBlock = payout.bic
      ? `        <CdtrAgt>
          <FinInstnId>
            <BIC>${escapeXml(payout.bic)}</BIC>
          </FinInstnId>
        </CdtrAgt>`
      : ''

    return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${instdAmt}</InstdAmt>
        </Amt>
${cdtrAgtBlock ? `${cdtrAgtBlock}\n` : ''}        <Cdtr>
          <Nm>${cdtrName}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${cdtrIban}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${ustrdTruncated}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03 pain.001.001.03.xsd">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${labelName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${reqExctnDt}</ReqdExctnDt>
      <Dbtr>
        <Nm>${labelName}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${labelIban}</IBAN>
        </Id>
      </DbtrAcct>
${dbtrAgtBlock}
${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`
}

export function downloadSepaXml(xml: string, filename?: string): void {
  const safeFilename = filename ?? `sepa-export-${new Date().toISOString().slice(0, 10)}.xml`
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = safeFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
