'use client'

import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FloppyDisk, Plus, Trash, Lock } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CsvImportProfile, FinancialFieldKey } from '@/lib/sos/ingest/types'

const FINANCIAL_FIELDS: FinancialFieldKey[] = [
  'salesMonth',
  'artistName',
  'netRevenue',
  'platform',
  'country',
  'quantity',
  'releaseTitle',
  'trackTitle',
  'currency',
  'releaseType',
  'catalogNumber',
  'upcEan',
  'isrc',
  'bandcampPackage',
]

interface CsvImportProfileEditorProps {
  profiles: CsvImportProfile[]
  customProfiles: CsvImportProfile[]
  onSave: (profile: CsvImportProfile) => void
  onDelete: (id: string) => void
}

export function CsvImportProfileEditor({
  profiles,
  customProfiles,
  onSave,
  onDelete,
}: CsvImportProfileEditorProps) {
  const [draft, setDraft] = useState<CsvImportProfile | null>(null)

  const startNew = () => {
    setDraft({
      id: uuidv4(),
      name: '',
      type: 'financial',
      delimiter: ',',
      autoDetectHeaders: [],
      columnMapping: {},
    })
  }

  const startEdit = (profile: CsvImportProfile) => {
    setDraft({ ...profile, columnMapping: { ...profile.columnMapping } })
  }

  const saveDraft = () => {
    if (!draft?.name.trim()) return
    const headers = draft.autoDetectHeaders.length > 0
      ? draft.autoDetectHeaders
      : Object.values(draft.columnMapping).filter((v): v is string => Boolean(v))
    onSave({ ...draft, autoDetectHeaders: headers })
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          CSV profiles drive auto-detection in the unified upload zone.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={startNew}>
          <Plus size={14} className="mr-1" /> New profile
        </Button>
      </div>

      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex items-center justify-between gap-2 p-3 border border-border rounded-lg bg-card/40"
          >
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5">
                {profile.isSystemDefault && <Lock size={12} className="text-muted-foreground" />}
                {profile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile.type} · delimiter &quot;{profile.delimiter}&quot; · {profile.autoDetectHeaders.length} detect headers
              </p>
            </div>
            {!profile.isSystemDefault && (
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(profile)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(profile.id)}>
                  <Trash size={14} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {draft && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card/50">
          <p className="text-sm font-medium">{customProfiles.some((p) => p.id === draft.id) ? 'Edit' : 'New'} CSV Profile</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delimiter</Label>
              <Select
                value={draft.delimiter}
                onValueChange={(v) => setDraft({ ...draft, delimiter: v as ',' | ';' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=";">Semicolon (;)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Auto-detect headers (comma-separated)</Label>
            <Input
              value={draft.autoDetectHeaders.join(', ')}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  autoDetectHeaders: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {FINANCIAL_FIELDS.map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs capitalize">{field}</Label>
                <Input
                  value={draft.columnMapping[field] ?? ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      columnMapping: { ...draft.columnMapping, [field]: e.target.value },
                    })
                  }
                  placeholder="CSV column name"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveDraft}>
              <FloppyDisk size={14} className="mr-1" /> Save profile
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}