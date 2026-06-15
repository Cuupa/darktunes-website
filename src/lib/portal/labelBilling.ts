import type { BillingParty } from '@/lib/portal/invoicePdf'

export const LABEL_BILLING_PARTY: BillingParty = {
  name: 'darkTunes Music Group',
  street: 'Friedhofweg 1',
  postalCode: '69118',
  city: 'Heidelberg',
  country: 'Germany',
  email: 'info@dark-tunes.com',
}

export const LABEL_CLIENT_NAME = LABEL_BILLING_PARTY.name
export const LABEL_CLIENT_EMAIL = LABEL_BILLING_PARTY.email ?? 'info@dark-tunes.com'
export const LABEL_CLIENT_ADDRESS = [
  LABEL_BILLING_PARTY.street,
  `${LABEL_BILLING_PARTY.postalCode} ${LABEL_BILLING_PARTY.city}`,
  LABEL_BILLING_PARTY.country,
].join(', ')
