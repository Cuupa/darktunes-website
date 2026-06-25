/**
 * Server-side dictionary loader — backed by next-intl namespaced messages.
 *
 * Prefer getTranslations() / useTranslations() in new code.
 * This bridge remains for server components not yet migrated off dict props.
 */

import { getLocale as getNextIntlLocale, getMessages } from 'next-intl/server'
import { loadMessages } from './loadMessages'
import type { Dictionary, Locale } from './types'

export async function getLocale(): Promise<Locale> {
  return (await getNextIntlLocale()) as Locale
}

export async function getPortalLocale(): Promise<Locale> {
  return getLocale()
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  if (locale) {
    return loadMessages(locale)
  }
  const messages = await getMessages()
  return messages as Dictionary
}

export async function getPortalDictionary(): Promise<Dictionary> {
  return getDictionary()
}