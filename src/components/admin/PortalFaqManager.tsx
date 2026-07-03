'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  CaretUp,
  CaretDown,
  ArrowSquareOut,
} from '@phosphor-icons/react'
import { usePortalFaq } from '@/hooks/usePortalFaq'
import { TiptapEditor } from '@/components/admin/TiptapEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { routing } from '@/i18n/routing'
import type { PortalFaqCategory, PortalFaqItem } from '@/types'

function slugFromText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

type DeleteTarget =
  | { kind: 'category'; id: string; label: string }
  | { kind: 'item'; id: string; label: string }

const EMPTY_CATEGORY = {
  slug: '',
  titleEn: '',
  titleDe: '',
  sortOrder: 0,
  isPublished: true,
}

const EMPTY_ITEM = {
  categoryId: '',
  slug: '',
  questionEn: '',
  questionDe: '',
  answerHtmlEn: '<p></p>',
  answerHtmlDe: '',
  keywords: '',
  portalRoute: '',
  sortOrder: 0,
  isPublished: true,
}

export function PortalFaqManager() {
  const t = useTranslations('admin.portalFaq')
  const {
    tree,
    categories,
    isLoading,
    saveCategory,
    patchCategory,
    removeCategory,
    saveItem,
    patchItem,
    removeItem,
  } = usePortalFaq()

  const [tab, setTab] = useState<'categories' | 'items'>('items')
  const [search, setSearch] = useState('')
  const [contentLocale, setContentLocale] = useState('en')
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [itemSheetOpen, setItemSheetOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PortalFaqCategory | null>(null)
  const [editingItem, setEditingItem] = useState<PortalFaqItem | null>(null)
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [saving, setSaving] = useState(false)

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tree
    return tree
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.questionEn.toLowerCase().includes(q) ||
            (item.questionDe?.toLowerCase().includes(q) ?? false) ||
            item.slug.toLowerCase().includes(q) ||
            item.keywords.some((k) => k.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.items.length > 0 || group.category.titleEn.toLowerCase().includes(q))
  }, [tree, search])

  const openNewCategory = () => {
    setEditingCategory(null)
    setCategoryForm({
      ...EMPTY_CATEGORY,
      sortOrder: (categories.length + 1) * 10,
    })
    setCategorySheetOpen(true)
  }

  const openEditCategory = (category: PortalFaqCategory) => {
    setEditingCategory(category)
    setCategoryForm({
      slug: category.slug,
      titleEn: category.titleEn,
      titleDe: category.titleDe ?? '',
      sortOrder: category.sortOrder,
      isPublished: category.isPublished,
    })
    setCategorySheetOpen(true)
  }

  const openNewItem = (categoryId?: string) => {
    setEditingItem(null)
    setItemForm({
      ...EMPTY_ITEM,
      categoryId: categoryId ?? categories[0]?.id ?? '',
      sortOrder: ((tree.find((g) => g.category.id === categoryId)?.items.length ?? itemsCount()) + 1) * 10,
    })
    setContentLocale('en')
    setItemSheetOpen(true)
  }

  function itemsCount() {
    return tree.reduce((sum, g) => sum + g.items.length, 0)
  }

  const openEditItem = (item: PortalFaqItem) => {
    setEditingItem(item)
    setItemForm({
      categoryId: item.categoryId,
      slug: item.slug,
      questionEn: item.questionEn,
      questionDe: item.questionDe ?? '',
      answerHtmlEn: item.answerHtmlEn,
      answerHtmlDe: item.answerHtmlDe ?? '',
      keywords: item.keywords.join(', '),
      portalRoute: item.portalRoute ?? '',
      sortOrder: item.sortOrder,
      isPublished: item.isPublished,
    })
    setContentLocale('en')
    setItemSheetOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.titleEn.trim()) {
      toast.error(t('validationTitleEn'))
      return
    }
    const slug = categoryForm.slug.trim() || slugFromText(categoryForm.titleEn)
    setSaving(true)
    try {
      if (editingCategory) {
        await patchCategory(editingCategory.id, {
          slug,
          titleEn: categoryForm.titleEn.trim(),
          titleDe: categoryForm.titleDe.trim() || null,
          sortOrder: categoryForm.sortOrder,
          isPublished: categoryForm.isPublished,
        })
        toast.success(t('categoryUpdated'))
      } else {
        await saveCategory({
          slug,
          titleEn: categoryForm.titleEn.trim(),
          titleDe: categoryForm.titleDe.trim() || null,
          sortOrder: categoryForm.sortOrder,
          isPublished: categoryForm.isPublished,
        })
        toast.success(t('categoryCreated'))
      }
      setCategorySheetOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveItem = async () => {
    if (!itemForm.categoryId || !itemForm.questionEn.trim() || !itemForm.answerHtmlEn.trim()) {
      toast.error(t('validationItemEn'))
      return
    }
    const slug = itemForm.slug.trim() || slugFromText(itemForm.questionEn)
    const keywords = itemForm.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    setSaving(true)
    try {
      const payload = {
        categoryId: itemForm.categoryId,
        slug,
        questionEn: itemForm.questionEn.trim(),
        questionDe: itemForm.questionDe.trim() || null,
        answerHtmlEn: itemForm.answerHtmlEn,
        answerHtmlDe: itemForm.answerHtmlDe.trim() || null,
        keywords,
        portalRoute: itemForm.portalRoute.trim() || null,
        sortOrder: itemForm.sortOrder,
        isPublished: itemForm.isPublished,
      }
      if (editingItem) {
        await patchItem(editingItem.id, payload)
        toast.success(t('itemUpdated'))
      } else {
        await saveItem(payload)
        toast.success(t('itemCreated'))
      }
      setItemSheetOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      if (deleteTarget.kind === 'category') {
        await removeCategory(deleteTarget.id)
        toast.success(t('categoryDeleted'))
      } else {
        await removeItem(deleteTarget.id)
        toast.success(t('itemDeleted'))
      }
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const moveCategory = async (category: PortalFaqCategory, direction: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((c) => c.id === category.id)
    const swap = sorted[idx + direction]
    if (!swap) return
    try {
      await patchCategory(category.id, { sortOrder: swap.sortOrder })
      await patchCategory(swap.id, { sortOrder: category.sortOrder })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveError'))
    }
  }

  const moveItem = async (item: PortalFaqItem, direction: -1 | 1) => {
    const group = tree.find((g) => g.category.id === item.categoryId)
    if (!group) return
    const sorted = [...group.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((i) => i.id === item.id)
    const swap = sorted[idx + direction]
    if (!swap) return
    try {
      await patchItem(item.id, { sortOrder: swap.sortOrder })
      await patchItem(swap.id, { sortOrder: item.sortOrder })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('saveError'))
    }
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'categories' | 'items')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="items">{t('tabItems')}</TabsTrigger>
            <TabsTrigger value="categories">{t('tabCategories')}</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            {tab === 'categories' ? (
              <Button type="button" size="sm" onClick={openNewCategory} className="gap-1.5">
                <Plus size={14} aria-hidden="true" />
                {t('addCategory')}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => openNewItem()} className="gap-1.5">
                <Plus size={14} aria-hidden="true" />
                {t('addItem')}
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="items" className="space-y-4 mt-4">
          <div className="relative max-w-md">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : filteredTree.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('emptyItems')}</p>
          ) : (
            filteredTree.map((group) => (
              <section key={group.category.id} className="rounded-lg border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div>
                    <h3 className="font-semibold">{group.category.titleEn}</h3>
                    <p className="text-xs text-muted-foreground">{group.category.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!group.category.isPublished && (
                      <Badge variant="outline">{t('draft')}</Badge>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => openNewItem(group.category.id)}>
                      {t('addItem')}
                    </Button>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.questionEn}</p>
                        {item.questionDe && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.questionDe}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.slug}</span>
                          {!item.isPublished && <Badge variant="outline">{t('draft')}</Badge>}
                          {item.portalRoute && (
                            <span className="inline-flex items-center gap-1">
                              <ArrowSquareOut size={12} aria-hidden="true" />
                              {item.portalRoute}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem(item, -1)} aria-label={t('moveUp')}>
                          <CaretUp size={14} />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveItem(item, 1)} aria-label={t('moveDown')}>
                          <CaretDown size={14} />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditItem(item)} aria-label={t('edit')}>
                          <PencilSimple size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget({ kind: 'item', id: item.id, label: item.questionEn })}
                          aria-label={t('delete')}
                        >
                          <Trash size={14} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('emptyCategories')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {[...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((category) => (
                <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{category.titleEn}</p>
                    <p className="text-xs text-muted-foreground">{category.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!category.isPublished && <Badge variant="outline">{t('draft')}</Badge>}
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveCategory(category, -1)} aria-label={t('moveUp')}>
                      <CaretUp size={14} />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveCategory(category, 1)} aria-label={t('moveDown')}>
                      <CaretDown size={14} />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditCategory(category)} aria-label={t('edit')}>
                      <PencilSimple size={14} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget({ kind: 'category', id: category.id, label: category.titleEn })}
                      aria-label={t('delete')}
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
        <SheetContent data-lenis-prevent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editingCategory ? t('editCategory') : t('addCategory')}</SheetTitle>
            <SheetDescription>{t('categoryHint')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-title-en">{t('titleEn')}</Label>
              <Input
                id="cat-title-en"
                value={categoryForm.titleEn}
                onChange={(e) => setCategoryForm((f) => ({ ...f, titleEn: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-title-de">{t('titleDeOptional')}</Label>
              <Input
                id="cat-title-de"
                value={categoryForm.titleDe}
                onChange={(e) => setCategoryForm((f) => ({ ...f, titleDe: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">{t('slug')}</Label>
              <Input
                id="cat-slug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={slugFromText(categoryForm.titleEn) || 'dashboard'}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="cat-published"
                checked={categoryForm.isPublished}
                onCheckedChange={(v) => setCategoryForm((f) => ({ ...f, isPublished: v }))}
              />
              <Label htmlFor="cat-published">{t('published')}</Label>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleSaveCategory} disabled={saving}>
              {t('save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={itemSheetOpen} onOpenChange={setItemSheetOpen}>
        <SheetContent data-lenis-prevent className="overflow-y-auto sm:max-w-2xl w-full">
          <SheetHeader>
            <SheetTitle>{editingItem ? t('editItem') : t('addItem')}</SheetTitle>
            <SheetDescription>{t('itemHint')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>{t('category')}</Label>
              <Select
                value={itemForm.categoryId}
                onValueChange={(v) => setItemForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.titleEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('contentLanguage')}:</span>
              {routing.locales.map((loc) => (
                <Button
                  key={loc}
                  type="button"
                  size="sm"
                  variant={contentLocale === loc ? 'default' : 'outline'}
                  className="h-8 text-xs uppercase"
                  onClick={() => setContentLocale(loc)}
                >
                  {loc}
                </Button>
              ))}
            </div>

            {contentLocale === 'en' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="item-question-en">{t('questionEn')}</Label>
                  <Input
                    id="item-question-en"
                    value={itemForm.questionEn}
                    onChange={(e) => setItemForm((f) => ({ ...f, questionEn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('answerEn')}</Label>
                  <TiptapEditor
                    value={itemForm.answerHtmlEn}
                    onChange={(html) => setItemForm((f) => ({ ...f, answerHtmlEn: html }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="item-question-de">{t('questionDeOptional')}</Label>
                  <Input
                    id="item-question-de"
                    value={itemForm.questionDe}
                    onChange={(e) => setItemForm((f) => ({ ...f, questionDe: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('answerDeOptional')}</Label>
                  <p className="text-xs text-muted-foreground">{t('deFallbackHint')}</p>
                  <TiptapEditor
                    value={itemForm.answerHtmlDe || '<p></p>'}
                    onChange={(html) => setItemForm((f) => ({ ...f, answerHtmlDe: html }))}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="item-slug">{t('slug')}</Label>
              <Input
                id="item-slug"
                value={itemForm.slug}
                onChange={(e) => setItemForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder={slugFromText(itemForm.questionEn) || 'how-to-submit'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-keywords">{t('keywords')}</Label>
              <Input
                id="item-keywords"
                value={itemForm.keywords}
                onChange={(e) => setItemForm((f) => ({ ...f, keywords: e.target.value }))}
                placeholder={t('keywordsPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-route">{t('portalRoute')}</Label>
              <Input
                id="item-route"
                value={itemForm.portalRoute}
                onChange={(e) => setItemForm((f) => ({ ...f, portalRoute: e.target.value }))}
                placeholder="/portal/releases"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="item-published"
                checked={itemForm.isPublished}
                onCheckedChange={(v) => setItemForm((f) => ({ ...f, isPublished: v }))}
              />
              <Label htmlFor="item-published">{t('published')}</Label>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={handleSaveItem} disabled={saving}>
              {t('save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteBody', { label: deleteTarget?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}