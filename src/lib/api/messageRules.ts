/**
 * src/lib/api/messageRules.ts
 *
 * CRUD helpers for message_rules.
 * Rules are evaluated on incoming messages to auto-move, star, or delete them.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MessageRule, LabelMessage } from '@/types'

type DbClient = SupabaseClient<Database>
type RuleRow = Database['public']['Tables']['message_rules']['Row']

function rowToRule(row: RuleRow): MessageRule {
  return {
    id: row.id,
    name: row.name,
    conditionField: row.condition_field as MessageRule['conditionField'],
    conditionOperator: row.condition_operator as MessageRule['conditionOperator'],
    conditionValue: row.condition_value,
    actionType: row.action_type as MessageRule['actionType'],
    actionTarget: row.action_target ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  }
}

export async function getRules(db: DbClient): Promise<MessageRule[]> {
  const { data, error } = await db
    .from('message_rules')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToRule)
}

export async function createRule(
  db: DbClient,
  rule: Omit<MessageRule, 'id' | 'createdAt'>,
): Promise<MessageRule> {
  const { data, error } = await db
    .from('message_rules')
    .insert({
      name: rule.name,
      condition_field: rule.conditionField,
      condition_operator: rule.conditionOperator,
      condition_value: rule.conditionValue,
      action_type: rule.actionType,
      action_target: rule.actionTarget ?? null,
      active: rule.active,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToRule(data)
}

export async function updateRule(
  db: DbClient,
  id: string,
  patch: Partial<Omit<MessageRule, 'id' | 'createdAt'>>,
): Promise<MessageRule> {
  const { data, error } = await db
    .from('message_rules')
    .update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.conditionField !== undefined && { condition_field: patch.conditionField }),
      ...(patch.conditionOperator !== undefined && { condition_operator: patch.conditionOperator }),
      ...(patch.conditionValue !== undefined && { condition_value: patch.conditionValue }),
      ...(patch.actionType !== undefined && { action_type: patch.actionType }),
      ...(patch.actionTarget !== undefined && { action_target: patch.actionTarget ?? null }),
      ...(patch.active !== undefined && { active: patch.active }),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return rowToRule(data)
}

export async function deleteRule(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('message_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Evaluate all active rules against a message and return the first matching rule.
 * Client-side evaluation for immediate UI feedback.
 */
export function evaluateRules(rules: MessageRule[], message: LabelMessage): MessageRule | null {
  for (const rule of rules) {
    if (!rule.active) continue
    const fieldValue = (() => {
      switch (rule.conditionField) {
        case 'subject':     return message.subject
        case 'body':        return message.body
        case 'artist_id':   return message.artistId
        case 'sender_email':return message.senderEmail ?? ''
        default:            return ''
      }
    })()
    const val = fieldValue.toLowerCase()
    const cond = rule.conditionValue.toLowerCase()
    const match = (() => {
      switch (rule.conditionOperator) {
        case 'contains':    return val.includes(cond)
        case 'equals':      return val === cond
        case 'starts_with': return val.startsWith(cond)
        case 'ends_with':   return val.endsWith(cond)
        default:            return false
      }
    })()
    if (match) return rule
  }
  return null
}
