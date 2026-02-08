import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { collection, query, onSnapshot, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CatalogProduct } from '../types/CatalogProduct';
import { PRODUCT_CATEGORIES, CATEGORY_BADGE_COLORS, type ProductCategory } from '../constants/categories';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { ImageSearchService } from '../services/ImageSearchService';

type SortKey = 'ean' | 'title' | 'brand' | 'weight' | 'category';
type ModalMode = 'view' | 'edit' | null;
type InlineEditField = 'title' | 'brand' | 'weight';

/** Retire les champs undefined pour que Firestore accepte l'objet (il refuse undefined). */
function sanitizeForFirestore<T extends Record<string, unknown>>(obj: T): Record<string, T[keyof T]> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Record<string, T[keyof T]>;
}

const Articles: React.FC = () => {
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<ModalMode>(null);
  const [selectedArticle, setSelectedArticle] = useState<CatalogProduct | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogProduct>>({});
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<CatalogProduct | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingCell, setEditingCell] = useState<{ ean: string; field: InlineEditField } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [enrichingOff, setEnrichingOff] = useState(false);
  const [offProgress, setOffProgress] = useState<string | null>(null);
  const [updatingImages, setUpdatingImages] = useState(false);
  const [imagesProgress, setImagesProgress] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'productCatalog'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const ddata = d.data();
        return {
          ean: d.id,
          title: ddata.title ?? '',
          brand: ddata.brand,
          weight: ddata.weight,
          category: ddata.category as ProductCategory | undefined,
          imageUrl: ddata.imageUrl,
          source: ddata.source,
          lastUpdated: ddata.lastUpdated,
        } as CatalogProduct;
      });
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredItems = useMemo(() => {
    let list = items;
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p) =>
          p.ean.includes(term) ||
          (p.title && p.title.toLowerCase().includes(term)) ||
          (p.brand && p.brand.toLowerCase().includes(term))
      );
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [items, searchTerm, categoryFilter]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredItems, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  /** Parse EAN depuis le format Excel Abaco : "=""2643905000000""" */
  const parseEan = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 12 && digits.length <= 14 ? digits.slice(-13).padStart(13, '0').slice(0, 13) : '';
  };

  /** Extrait le poids du titre (ex. "1KG", "500G", "0.9.1KG") et le retire du titre */
  const extractWeightFromTitle = (title: string): { title: string; weight?: string } => {
    const trimmed = title.trim();
    const match = trimmed.match(/\s+(\d+(?:[.,]\d+)*)\s*(kg|g|KG|G)\s*$/i);
    if (match) {
      const num = match[1].replace(',', '.');
      const unit = match[2].toLowerCase();
      const weight = `${num}${unit}`;
      const newTitle = trimmed.slice(0, match.index).trim();
      return { title: newTitle, weight };
    }
    return { title: trimmed };
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const dataLines = lines.slice(4);
      const now = new Date().toISOString();
      const toUpsert: { ean: string; title: string; weight?: string }[] = [];
      for (const line of dataLines) {
        const parts = line.split(';');
        if (parts.length < 2) continue;
        const rawEan = (parts[0] ?? '').replace(/^"|"$/g, '').trim();
        const ean = parseEan(rawEan);
        const rawTitle = (parts[1] ?? '').replace(/^"|"$/g, '').trim();
        const { title, weight } = extractWeightFromTitle(rawTitle);
        if (ean && title) toUpsert.push({ ean, title, ...(weight && { weight }) });
      }
      const BATCH_SIZE = 500;
      let written = 0;
      for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = toUpsert.slice(i, i + BATCH_SIZE);
        for (const row of chunk) {
          batch.set(doc(db, 'productCatalog', row.ean), {
            ean: row.ean,
            title: row.title,
            ...(row.weight && { weight: row.weight }),
            source: 'abaco',
            lastUpdated: now,
          });
        }
        await batch.commit();
        written += chunk.length;
      }
      setImportMessage(`Import terminé : ${written} article(s) importé(s).`);
      setTimeout(() => setImportMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setImportMessage('Erreur lors de l\'import. Vérifiez le format du fichier (CSV Abaco ; séparateur).');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['EAN', 'Titre', 'Marque', 'Poids', 'Catégorie'];
    const rows = sortedItems.map((p) =>
      [p.ean, p.title, p.brand ?? '', p.weight ?? '', p.category ?? ''].map((c) =>
        /[",;\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c
      ).join(';')
    );
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue-articles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openSheet = (article: CatalogProduct, mode: 'view' | 'edit') => {
    setSelectedArticle(article);
    setSheetMode(mode);
    setEditForm({
      title: article.title,
      brand: article.brand ?? '',
      weight: article.weight ?? '',
      category: article.category,
      imageUrl: article.imageUrl ?? '',
    });
    setSheetModalOpen(true);
  };

  const closeSheet = () => {
    setSheetModalOpen(false);
    setSheetMode(null);
    setSelectedArticle(null);
  };

  const handleSaveSheet = async () => {
    if (!selectedArticle) return;
    setSaving(true);
    try {
      const payload: Omit<CatalogProduct, 'ean'> = {
        title: editForm.title ?? selectedArticle.title,
        brand: editForm.brand || undefined,
        weight: editForm.weight || undefined,
        category: editForm.category,
        imageUrl: editForm.imageUrl || undefined,
        source: 'manual',
        lastUpdated: new Date().toISOString(),
      };
      const data = sanitizeForFirestore({ ...selectedArticle, ...payload });
      await setDoc(doc(db, 'productCatalog', selectedArticle.ean), data);
      closeSheet();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (row: CatalogProduct, field: InlineEditField) => {
    setEditingCell({ ean: row.ean, field });
    const val = row[field];
    setEditingValue(typeof val === 'string' ? val : '');
  };

  const saveInlineEdit = async () => {
    if (!editingCell) return;
    const { ean, field } = editingCell;
    try {
      await updateDoc(doc(db, 'productCatalog', ean), {
        [field]: editingValue.trim() || null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
    setEditingCell(null);
  };

  const handleCategoryChange = async (ean: string, category: ProductCategory | '') => {
    try {
      await updateDoc(doc(db, 'productCatalog', ean), {
        category: category || null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateImages = async () => {
    const withoutImage = items.filter((r) => !r.imageUrl?.trim());
    if (withoutImage.length === 0) {
      setImportMessage('Tous les articles ont déjà une image.');
      setTimeout(() => setImportMessage(null), 4000);
      return;
    }
    const GOOGLE_LIMIT_PER_RUN = 80;
    setUpdatingImages(true);
    setImagesProgress(`0 / ${withoutImage.length}`);
    let updated = 0;
    let googleUsed = 0;
    for (let i = 0; i < withoutImage.length; i++) {
      const row = withoutImage[i];
      setImagesProgress(`${i + 1} / ${withoutImage.length}`);
      let url: string | null = null;
      if (googleUsed < GOOGLE_LIMIT_PER_RUN) {
        try {
          url = await ImageSearchService.searchImage(row.ean, row.title);
          if (url) googleUsed++;
        } catch {
          // try OFF next
        }
      }
      if (!url) url = await fetchOffImageUrl(row.ean);
      if (url) {
        await updateDoc(doc(db, 'productCatalog', row.ean), {
          imageUrl: url,
          lastUpdated: new Date().toISOString(),
        });
        updated++;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    setUpdatingImages(false);
    setImagesProgress(null);
    setImportMessage(
      `Images : ${updated} mis à jour (Google : ${googleUsed}, OFF en secours). Relancez pour les ${Math.max(0, withoutImage.length - updated)} restants.`
    );
    setTimeout(() => setImportMessage(null), 8000);
  };

  /** Récupère marque et poids depuis Open Food Facts (par EAN). Ne remplit que les champs renvoyés par l’API. */
  const fetchOffByEan = async (ean: string): Promise<{ brand?: string; weight?: string }> => {
    try {
      const { data } = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
      if (data.status !== 1 || !data.product) return {};
      const p = data.product;
      const brand = (p.brands ?? p.brand_owner ?? '').trim().split(',')[0].trim() || undefined;
      const weight = (p.quantity ?? '').trim() || undefined;
      return { brand, weight };
    } catch {
      return {};
    }
  };

  /** Récupère l'URL de l'image produit depuis Open Food Facts (gratuit, pas de quota). */
  const fetchOffImageUrl = async (ean: string): Promise<string | null> => {
    try {
      const { data } = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
      if (data.status !== 1 || !data.product) return null;
      const p = data.product;
      return (p.image_front_url || p.image_url || p.image_small_url || '').trim() || null;
    } catch {
      return null;
    }
  };

  /** Enrichit avec Open Food Facts les articles sans marque ou sans poids (données actuelles non écrasées). */
  const handleEnrichWithOff = async () => {
    const toEnrich = items.filter((r) => !r.brand?.trim() || !r.weight?.trim());
    if (toEnrich.length === 0) {
      setImportMessage('Aucun article à enrichir (tous ont déjà marque et poids).');
      setTimeout(() => setImportMessage(null), 4000);
      return;
    }
    setEnrichingOff(true);
    setOffProgress(`0 / ${toEnrich.length}`);
    let updated = 0;
    for (let i = 0; i < toEnrich.length; i++) {
      const row = toEnrich[i];
      setOffProgress(`${i + 1} / ${toEnrich.length}`);
      const off = await fetchOffByEan(row.ean);
      const updates: Partial<CatalogProduct> = { lastUpdated: new Date().toISOString() };
      if (!row.brand?.trim() && off.brand) updates.brand = off.brand;
      if (!row.weight?.trim() && off.weight) updates.weight = off.weight;
      if (Object.keys(updates).length > 1) {
        await updateDoc(doc(db, 'productCatalog', row.ean), updates);
        updated++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setEnrichingOff(false);
    setOffProgress(null);
    setImportMessage(`Enrichissement terminé : ${updated} article(s) mis à jour avec Open Food Facts.`);
    setTimeout(() => setImportMessage(null), 6000);
  };

  const openDeleteConfirm = (article: CatalogProduct) => {
    setArticleToDelete(article);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!articleToDelete) return;
    try {
      await deleteDoc(doc(db, 'productCatalog', articleToDelete.ean));
      setArticleToDelete(null);
      setDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression');
    }
  };

  const SortHeader: React.FC<{ id: SortKey; label: string }> = ({ id, label }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-slate-100"
      onClick={() => handleSort(id)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === id && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
      </span>
    </TableHead>
  );

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Catalogue articles</h1>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher (EAN, titre, marque…)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Toutes les catégories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={sortedItems.length === 0}>
          Export CSV
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImportCsv}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Import en cours…' : 'Importer CSV'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEnrichWithOff}
          disabled={enrichingOff || updatingImages || items.length === 0}
          title="Remplir marque et poids manquants depuis Open Food Facts"
        >
          {enrichingOff ? `OFF… ${offProgress ?? ''}` : 'Enrichir avec OFF'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUpdateImages}
          disabled={enrichingOff || updatingImages || items.length === 0}
          title="Remplir les images manquantes (Google prioritaire, puis Open Food Facts)"
        >
          {updatingImages ? `Images… ${imagesProgress ?? ''}` : 'Mettre à jour les images'}
        </Button>
      </div>
      {(importMessage || (enrichingOff && offProgress) || (updatingImages && imagesProgress)) && (
        <p className={`text-sm ${importMessage?.startsWith('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
          {updatingImages && imagesProgress
            ? `Mise à jour des images… ${imagesProgress}`
            : enrichingOff && offProgress
              ? `Enrichissement Open Food Facts… ${offProgress}`
              : importMessage}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : sortedItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Aucun article dans le catalogue. Importez un CSV ou ajoutez des articles manuellement.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <SortHeader id="ean" label="EAN" />
                <TableHead className="w-[80px]">Photo</TableHead>
                <SortHeader id="title" label="Titre" />
                <SortHeader id="brand" label="Marque" />
                <SortHeader id="weight" label="Poids" />
                <SortHeader id="category" label="Catégorie" />
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((row) => (
                <TableRow key={row.ean} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-sm">{row.ean}</TableCell>
                  <TableCell className="w-[80px] p-1">
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt=""
                        className="h-12 w-12 object-contain rounded border border-slate-200"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                        —
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px]" title={row.title}>
                    {editingCell?.ean === row.ean && editingCell?.field === 'title' ? (
                      <Input
                        className="h-8 text-sm"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="block truncate cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1"
                        onClick={() => startInlineEdit(row, 'title')}
                      >
                        {row.title || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.ean === row.ean && editingCell?.field === 'brand' ? (
                      <Input
                        className="h-8 text-sm"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="block cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 min-w-[60px]"
                        onClick={() => startInlineEdit(row, 'brand')}
                      >
                        {row.brand ?? '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.ean === row.ean && editingCell?.field === 'weight' ? (
                      <Input
                        className="h-8 text-sm w-20"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={saveInlineEdit}
                        onKeyDown={(e) => e.key === 'Enter' && saveInlineEdit()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="block cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 w-14"
                        onClick={() => startInlineEdit(row, 'weight')}
                      >
                        {row.weight ?? '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <select
                      value={row.category ?? ''}
                      onChange={(e) => handleCategoryChange(row.ean, (e.target.value || '') as ProductCategory | '')}
                      className={`h-8 min-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-xs ${
                        row.category
                          ? `font-medium ${CATEGORY_BADGE_COLORS[row.category] ?? 'bg-slate-100 text-slate-700'}`
                          : 'text-slate-500'
                      }`}
                    >
                      <option value="">Choisir…</option>
                      {PRODUCT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openSheet(row, 'view')}
                        title="Voir"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openSheet(row, 'edit')}
                        title="Modifier"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => openDeleteConfirm(row)}
                        title="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Product sheet modal */}
      <Modal
        isOpen={sheetModalOpen}
        onClose={closeSheet}
        title={sheetMode === 'edit' ? 'Modifier l\'article' : 'Fiche article'}
        size="large"
      >
        {selectedArticle && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">EAN</label>
              <p className="text-slate-900 font-mono">{selectedArticle.ean}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
              {sheetMode === 'edit' ? (
                <Input
                  value={editForm.title ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              ) : (
                <p className="text-slate-900">{selectedArticle.title}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Marque</label>
              {sheetMode === 'edit' ? (
                <Input
                  value={editForm.brand ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                />
              ) : (
                <p className="text-slate-900">{selectedArticle.brand ?? '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Poids</label>
              {sheetMode === 'edit' ? (
                <Input
                  value={editForm.weight ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                  placeholder="ex. 500g, 1kg"
                />
              ) : (
                <p className="text-slate-900">{selectedArticle.weight ?? '—'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
              {sheetMode === 'edit' ? (
                <select
                  value={editForm.category ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      category: (e.target.value || undefined) as ProductCategory | undefined,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Non renseigné</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-slate-900">
                  {selectedArticle.category ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLORS[selectedArticle.category] ?? 'bg-slate-100 text-slate-700'}`}
                    >
                      {selectedArticle.category}
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
              )}
            </div>
            {selectedArticle.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
                <img
                  src={selectedArticle.imageUrl}
                  alt=""
                  className="max-h-40 rounded object-contain border border-slate-200"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={closeSheet}>
                Fermer
              </Button>
              {sheetMode === 'edit' && (
                <Button onClick={handleSaveSheet} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setArticleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Supprimer l'article"
        message={
          articleToDelete
            ? `Supprimer « ${articleToDelete.title} » (EAN ${articleToDelete.ean}) du catalogue ?`
            : ''
        }
      />
    </div>
  );
};

export default Articles;
