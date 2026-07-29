'use client'

/**
 * src/components/admin/sos/ExpenseManager.tsx
 *
 * Manages expense entries deducted from artist revenues.
 */

import { useMemo, useState } from 'react'
import { Plus, Trash, Receipt, Pencil } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { motion, AnimatePresence } from 'framer-motion'
import type { ExpenseEntry } from '@/lib/sos/types'
import { DateField } from '@/components/ui/date-field'
import { MoneyField, isMoneyInputValid } from '@/components/admin/sos/fields/AccountingNumberFields'
import { isValidIsoDate } from '@/lib/sos/accountingInputValidation'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

export interface ExpenseManagerProps {
  expenses: ExpenseEntry[]
  onAddExpense: (expense: Omit<ExpenseEntry, 'id'>) => void
  onRemoveExpense: (id: string) => void
  onUpdateExpense?: (id: string, update: Omit<ExpenseEntry, 'id'>) => void
  artists?: string[]
}

interface ExpenseFormProps {
  initialArtist?: string
  initialDescription?: string
  initialAmount?: number
  initialDate?: string
  artists: string[]
  onSave: (entry: Omit<ExpenseEntry, 'id'>) => void
  onCancel: () => void
  saveLabel?: string
}

function ExpenseForm({
  initialArtist = '',
  initialDescription = '',
  initialAmount,
  initialDate,
  artists,
  onSave,
  onCancel,
  saveLabel,
}: ExpenseFormProps) {
  const t = useAccountingLabels()
  const [artist, setArtist] = useState(initialArtist)
  const [artistInput, setArtistInput] = useState(artists.includes(initialArtist) ? '' : initialArtist)
  const [description, setDescription] = useState(initialDescription)
  const [amount, setAmount] = useState(initialAmount !== undefined ? initialAmount.toFixed(2) : '')
  const [date, setDate] = useState(initialDate ?? new Date().toISOString().split('T')[0] ?? '')

  const effectiveArtist =
    artists.length > 0 && artists.includes(artist)
      ? artist
      : artist === '__manual__'
        ? artistInput
        : artists.length === 0
          ? artistInput
          : artist

  const amountValid = isMoneyInputValid(amount, { allowZero: false })
  const dateValid = isValidIsoDate(date)
  const canSave =
    effectiveArtist.trim().length > 0 &&
    description.trim().length > 0 &&
    amountValid &&
    dateValid

  const moneyMessages = useMemo(
    () => ({
      required: t.validationFieldRequired,
      invalid: t.validationFieldInvalidNumber,
      out_of_range: t.validationAmountPositive,
      too_many_decimals: t.validationAmountMaxDecimals,
    }),
    [t],
  )

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Artist</Label>
        {artists.length > 0 ? (
          <>
            <Select
              value={artist}
              onValueChange={(v) => {
                setArtist(v)
                if (v !== '__manual__') setArtistInput('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.selectArtistPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
                <SelectItem value="__manual__">{t.enterArtistManually}</SelectItem>
              </SelectContent>
            </Select>
            {artist === '__manual__' && (
              <Input
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value.slice(0, 120))}
                placeholder={t.artistNamePlaceholder}
                className="mt-1"
                maxLength={120}
              />
            )}
          </>
        ) : (
          <Input
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value.slice(0, 120))}
            placeholder={t.artistNamePlaceholder}
            maxLength={120}
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expense-desc">Description</Label>
        <Input
          id="expense-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder="e.g. Music video production"
          maxLength={300}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MoneyField
          id="expense-amount"
          label="Amount (EUR)"
          value={amount}
          onChange={setAmount}
          prefix="€"
          messages={moneyMessages}
        />
        <DateField
          id="expense-date"
          label="Date"
          value={date}
          onChange={setDate}
          required
          error={date && !dateValid ? t.validationInvalidDate : undefined}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (!canSave) return
            const parsed = Number(amount.replace(',', '.'))
            onSave({
              artist: effectiveArtist.trim(),
              description: description.trim(),
              amount: Math.round(parsed * 100) / 100,
              date,
            })
          }}
          disabled={!canSave}
        >
          {saveLabel ?? 'Add Expense'}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ExpenseManager({
  expenses,
  onAddExpense,
  onRemoveExpense,
  onUpdateExpense,
  artists = [],
}: ExpenseManagerProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ExpenseEntry | null>(null)

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={20} weight="bold" className="text-primary" />
          <h3 className="font-semibold">Expenses</h3>
          {expenses.length > 0 && (
            <Badge variant="secondary">
              {expenses.length} · €{totalExpenses.toFixed(2)}
            </Badge>
          )}
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus size={16} weight="bold" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>
                Add an expense to be deducted from an artist&apos;s payout.
              </DialogDescription>
            </DialogHeader>
            <ExpenseForm
              artists={artists}
              onSave={(entry) => {
                onAddExpense(entry)
                setAddOpen(false)
              }}
              onCancel={() => setAddOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <AnimatePresence mode="popLayout">
        {expenses.length > 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {expenses.map((expense, index) => (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="p-3 flex items-center gap-3 bg-card hover:shadow-md transition-shadow">
                  <Receipt size={18} className="text-rose-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.artist} · {expense.date}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-rose-400 shrink-0">
                    –€{expense.amount.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateExpense && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(expense)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveExpense(expense.id)}
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <Receipt size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No expenses recorded.</p>
          </Card>
        )}
      </AnimatePresence>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense Entry</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <ExpenseForm
              initialArtist={editTarget.artist}
              initialDescription={editTarget.description}
              initialAmount={editTarget.amount}
              initialDate={editTarget.date}
              artists={artists}
              onSave={(entry) => {
                onUpdateExpense?.(editTarget.id, entry)
                setEditTarget(null)
              }}
              onCancel={() => setEditTarget(null)}
              saveLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
