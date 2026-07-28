'use client'

/**
 * src/components/admin/sos/EmailConfigManager.tsx
 *
 * UI for configuring the EmailConfig used when sending PDF statements
 * to artists via email (mailto links and optional email sending).
 */

import { EnvelopeSimple } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EmailConfig } from '@/lib/sos/types'
import { EmailField } from '@/components/admin/sos/fields/AccountingTextFields'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

interface EmailConfigManagerProps {
  config: Partial<EmailConfig>
  onUpdate: (next: Partial<EmailConfig>) => void
}

export function EmailConfigManager({ config, onUpdate }: EmailConfigManagerProps) {
  const t = useAccountingLabels()
  const patch = (partial: Partial<EmailConfig>) => onUpdate({ ...config, ...partial })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <EnvelopeSimple size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">Email Settings</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        These settings are used to pre-fill the From/Reply-To fields when generating mailto links
        or sending PDF statements directly to artists.
      </p>

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email-from-name" className="flex items-center gap-1.5">
              <EnvelopeSimple size={14} /> From Name
            </Label>
            <Input
              id="email-from-name"
              type="text"
              value={config.fromName ?? ''}
              maxLength={120}
              onChange={(e) => patch({ fromName: e.target.value.slice(0, 120) })}
              placeholder="e.g. darkTunes Music Group"
            />
            <p className="text-xs text-muted-foreground">Display name in the From field.</p>
          </div>

          <EmailField
            id="email-from-addr"
            label="From Email"
            value={config.fromEmail ?? ''}
            onChange={(v) => patch({ fromEmail: v })}
            placeholder="e.g. finance@label.com"
            description="Sender address."
            errorMessage={t.validationInvalidEmail}
          />
        </div>

        <EmailField
          id="email-reply-to"
          label="Reply-To (optional)"
          value={config.replyTo ?? ''}
          onChange={(v) => patch({ replyTo: v })}
          placeholder="Same as From Email if left empty"
          className="max-w-sm"
          errorMessage={t.validationInvalidEmail}
        />

        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject Template</Label>
          <Input
            id="email-subject"
            type="text"
            value={config.subjectTemplate ?? ''}
            maxLength={200}
            onChange={(e) => patch({ subjectTemplate: e.target.value.slice(0, 200) })}
            placeholder="Statement of Sales – {period}"
          />
          <p className="text-xs text-muted-foreground">
            Available placeholders: <code className="text-primary">{'{artist}'}</code>,{' '}
            <code className="text-primary">{'{period}'}</code>.
          </p>
        </div>
      </Card>
    </div>
  )
}
