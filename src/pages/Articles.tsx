import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, setDoc } from 'firebase/firestore';
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

type SortKey = 'ean' | 'title' | 'brand' | 'weight' | 'category';
type ModalMode = 'view' | 'edit' | null;

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
      await setDoc(doc(db, 'productCatalog', selectedArticle.ean), {
        ...selectedArticle,
        ...payload,
      });
      closeSheet();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
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
      </div>

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
                  <TableCell className="max-w-[200px] truncate" title={row.title}>
                    {row.title}
                  </TableCell>
                  <TableCell>{row.brand ?? '—'}</TableCell>
                  <TableCell>{row.weight ?? '—'}</TableCell>
                  <TableCell>
                    {row.category ? (
                      <span
                        className={
                          CATEGORY_BADGE_COLORS[row.category]
                            ? `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE_COLORS[row.category]}`
                            : 'text-slate-500'
                        }
                      >
                        {row.category}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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
