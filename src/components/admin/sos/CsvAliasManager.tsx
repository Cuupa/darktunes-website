'use client'

/**
 * src/components/admin/sos/CsvAliasManager.tsx
 *
 * UI for managing custom CSV column synonyms (CSVColumnAlias).
 * Allows the admin to map non-standard column headers in distributor CSVs
 * to the correct internal field names.
 */

import { useCallback, useState } from 'react'
import { Plus, GearSix, CheckCircle, Info, Trash } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { semanticDictionary } from '@/lib/sos/ingest/csv-parser'
import type { CSVColumnAlias } from '@/lib/sos/types'

interface CsvAliasManagerProps {
  aliases: CSVColumnAlias[]
  onAddAlias: (alias: Omit<CSVColumnAlias, 'id'>) => void
  onRemoveAlias: (id: string) => void
}

const FIELD_LABELS: Record<string, string> = {
  sales_month:     'Sales Month',
  platform:        'Platform / Store',
  country:         'Country / Region',
  original_artist: 'Artist Name',
  release_title:   'Release Title',
  track_title:     'Track Title',
  upc_ean:         'UPC / EAN',
  isrc:            'ISRC',
  catalog_number:  'Catalog Number',
  quantity:        'Quantity / Streams',
  net_revenue:     'Net Revenue',
  currency:        'Currency',
  release_type:    'Release Type',
}

const FIELD_NAMES = Object.keys(semanticDictionary)

export function CsvAliasManager({ aliases, onAddAlias, onRemoveAlias }: CsvAliasManagerProps) {
  const [selectedField, setSelectedField] = useState<string>(FIELD_NAMES[0])
  const [synonym, setSynonym] = useState('')
  const [error, setError] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = synonym.trim()
    if (!trimmed) {
      setError('Please enter a column header name')
      return
    }
    const isDuplicate = aliases.some(
      a => a.fieldName === selectedField && a.synonym.toLowerCase() === trimmed.toLowerCase()
    )
    if (isDuplicate) {
      setError('This synonym already exists for this field')
      return
    }
    const usedOnOtherField = aliases.find(
      a => a.fieldName !== selectedField && a.synonym.toLowerCase() === trimmed.toLowerCase()
    )
    if (usedOnOtherField) {
      setError(`"${trimmed}" is already mapped to "${FIELD_LABELS[usedOnOtherField.fieldName] ?? usedOnOtherField.fieldName}"`)
      return
    }
    onAddAlias({ fieldName: selectedField, synonym: trimmed })
    setSynonym('')
    setError('')
  }, [synonym, selectedField, aliases, onAddAlias])

  const aliasesForField = (fieldName: string) =>
    aliases.filter(a => a.fieldName === fieldName)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <GearSix size={20} weight="bold" className="text-primary" />
        <h3 className="font-semibold">CSV Column Mapping</h3>
      </div>

      <Card className="p-4 border border-primary/20 bg-primary/5">
        <div className="flex gap-2">
          <Info size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            The tool automatically maps CSV column headers to the correct data fields using a built-in
            vocabulary. Add custom synonyms here if your CSV uses non-standard column names.
          </p>
        </div>
      </Card>

      {/* Add new alias */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Add Custom Column Synonym</h4>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedField} onValueChange={setSelectedField}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_NAMES.map(name => (
                <SelectItem key={name} value={name}>
                  {FIELD_LABELS[name] ?? name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 flex gap-2 min-w-48">
            <div className="flex-1 space-y-1">
              <Input
                value={synonym}
                onChange={e => { setSynonym(e.target.value); setError('') }}
                placeholder={`e.g. "My Revenue Column"`}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button onClick={handleAdd} disabled={!synonym.trim()} className="gap-1">
              <Plus size={16} weight="bold" /> Add
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Field reference table */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Field Reference &amp; Custom Synonyms</h4>
        <div className="space-y-3">
          {FIELD_NAMES.map(fieldName => {
            const builtIn = semanticDictionary[fieldName] ?? []
            const custom = aliasesForField(fieldName)

            return (
              <Card key={fieldName} className="p-4 border">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-sm">{FIELD_LABELS[fieldName] ?? fieldName}</p>
                      <Badge variant="secondary" className="text-xs font-mono">{fieldName}</Badge>
                    </div>

                    {/* Built-in synonyms */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {builtIn.map(syn => (
                        <span
                          key={syn}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground"
                        >
                          <CheckCircle size={10} className="text-green-500" /> {syn}
                        </span>
                      ))}
                    </div>

                    {/* Custom synonyms */}
                    {custom.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {custom.map(alias => (
                          <span
                            key={alias.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-xs text-primary border border-primary/20"
                          >
                            <Plus size={10} className="text-primary" /> {alias.synonym}
                            <button
                              onClick={() => onRemoveAlias(alias.id)}
                              className="ml-0.5 hover:text-destructive transition-colors"
                              title="Remove"
                            >
                              <Trash size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
