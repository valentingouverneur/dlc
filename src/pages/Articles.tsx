import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { collection, query, where, limit, getDocs, onSnapshot, deleteDoc, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
  const [updatingMissing, setUpdatingMissing] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string | null>(null);
  const [enrichingOff, setEnrichingOff] = useState(false);
  const [offProgress, setOffProgress] = useState<string | null>(null);
  const [updatingImages, setUpdatingImages] = useState(false);
  const [imagesProgress, setImagesProgress] = useState<string | null>(null);
  const [assigningCategories, setAssigningCategories] = useState(false);
  const [assignProgress, setAssignProgress] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<{ url: string; source: 'google' | 'off' | 'affiche' }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

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
    setGalleryOpen(false);
    setGalleryUrls([]);
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
    let fromAffiches = 0;
    let googleUsed = 0;
    for (let i = 0; i < withoutImage.length; i++) {
      const row = withoutImage[i];
      setImagesProgress(`${i + 1} / ${withoutImage.length}`);
      let url: string | null = null;
      url = await getImageFromAffiches(row.ean);
      if (url) fromAffiches++;
      if (!url && googleUsed < GOOGLE_LIMIT_PER_RUN) {
        try {
          url = await ImageSearchService.searchImage(row.ean, row.title);
          if (url) googleUsed++;
        } catch {
          //
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
    const parts = [`${updated} mis à jour`];
    if (fromAffiches) parts.push(`Affiches : ${fromAffiches}`);
    if (googleUsed) parts.push(`Google : ${googleUsed}`);
    if (updated > fromAffiches + googleUsed) parts.push('OFF en secours');
    setImportMessage(`Images : ${parts.join(' • ')}. Relancez pour les ${Math.max(0, withoutImage.length - updated)} restants.`);
    setTimeout(() => setImportMessage(null), 8000);
  };

  /** Récupère marque et poids depuis Open Food Facts (par EAN). Ne remplit que les champs renvoyés par l’API. */
  const openImageGallery = async () => {
    if (!selectedArticle) return;
    setGalleryOpen(true);
    setGalleryLoading(true);
    setGalleryUrls([]);
    try {
      const afficheUrl = await getImageFromAffiches(selectedArticle.ean);
      const [googleUrls, offUrls] = await Promise.all([
        ImageSearchService.searchGoogleImageAll(selectedArticle.ean, selectedArticle.title),
        fetchOffAllImageUrls(selectedArticle.ean),
      ]);
      const withSource: { url: string; source: 'google' | 'off' | 'affiche' }[] = [];
      if (afficheUrl) withSource.push({ url: afficheUrl, source: 'affiche' });
      withSource.push(
        ...googleUrls.map((url) => ({ url, source: 'google' as const })),
        ...offUrls.map((url) => ({ url, source: 'off' as const })),
      );
      const seen = new Set<string>();
      const deduped = withSource.filter(({ url }) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      });
      setGalleryUrls(deduped);
    } catch (err) {
      console.error(err);
    } finally {
      setGalleryLoading(false);
    }
  };

  const selectGalleryImage = async (url: string) => {
    if (!selectedArticle) return;
    try {
      await updateDoc(doc(db, 'productCatalog', selectedArticle.ean), {
        imageUrl: url,
        lastUpdated: new Date().toISOString(),
      });
      setSelectedArticle({ ...selectedArticle, imageUrl: url });
      setEditForm((f) => ({ ...f, imageUrl: url }));
      setGalleryOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  /** Map OFF categories string (ou hierarchy) vers notre catégorie fixe. */
  const mapOffToCategory = (p: { categories?: string; categories_hierarchy?: string[] }): ProductCategory | null => {
    const raw = [
      (p.categories ?? ''),
      Array.isArray(p.categories_hierarchy) ? p.categories_hierarchy.join(' ') : '',
    ].join(' ').toLowerCase();
    if (/meat|viande|beef|pork|volaille|poultry|canard|duck|agneau|lambs?|steak|burger/.test(raw)) return 'Viande';
    if (/fish|seafood|poisson|saumon|colin|crevette|cabillaud|truite|thon|sardine|langouste|pangas|sole/.test(raw)) return 'Poisson';
    if (/ice.?cream|glace|sorbet|frozen.?dessert|magnum|extreme/.test(raw)) return 'Glaces';
    if (/vegetable|legume|legumes|haricot|epinard|petits.?pois|carotte|chou|brocoli|surgel/.test(raw) && !/pizza|plat|ready/.test(raw)) return 'Légumes';
    if (/pizza/.test(raw)) return 'Pizza';
    if (/fries|frite|frites|potato/.test(raw)) return 'Frites';
    if (/ready.?meal|plat.?prepar|prepared|gratin|lasagne|poelee|parmentier|souffle|quiche/.test(raw)) return 'Plats cuisinés';
    if (/starter|entree|entrée|soup|soupe/.test(raw)) return 'Entrée';
    return null;
  };

  const fetchOffByEan = async (ean: string): Promise<{ brand?: string; weight?: string; category?: ProductCategory }> => {
    try {
      const { data } = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
      if (data.status !== 1 || !data.product) return {};
      const p = data.product;
      const brand = (p.brands ?? p.brand_owner ?? '').trim().split(',')[0].trim() || undefined;
      const weight = (p.quantity ?? '').trim() || undefined;
      const category = mapOffToCategory(p);
      return { brand, weight, category: category ?? undefined };
    } catch {
      return {};
    }
  };

  /** Infère une catégorie à partir du titre (désignation). Ordre des règles = priorité. */
  const inferCategoryFromTitle = (title: string): ProductCategory | null => {
    const t = (title ?? '').toLowerCase();
    if (/pizza/.test(t)) return 'Pizza';
    if (/\b(steak|boeuf|burgers?|viande|canard|volaille|poulet|agneau|charal|hache)\b/.test(t)) return 'Viande';
    if (/\b(saumon|colin|crevette|cabillaud|truite|thon|poisson|langouste|pangas|sole|filet de)\b/.test(t)) return 'Poisson';
    if (/\b(glace|extreme|magnum|sorbet)\b/.test(t)) return 'Glaces';
    if (/\b(frite|frites|pommes?\s*de\s*terre)\b/.test(t) && !/gratin|puree|poelee/.test(t)) return 'Frites';
    if (/\b(haricot|epinard|petits?\s*pois|legume|legumes|chou|brocoli|carotte|poelee\s*leg|surgel)\b/.test(t)) return 'Légumes';
    if (/\b(gratin|lasagne|poelee|parmentier|quiche|souffle|plat\s*cuisin)\b/.test(t)) return 'Plats cuisinés';
    if (/\b(soupe|soup)\b/.test(t)) return 'Entrée';
    return null;
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

  /** Récupère l'image déjà utilisée sur une affiche pour cet EAN (évite requêtes Google). */
  const getImageFromAffiches = async (ean: string): Promise<string | null> => {
    try {
      const q = query(
        collection(db, 'affiches'),
        where('ean', '==', ean),
        limit(1)
      );
      const snap = await getDocs(q);
      const first = snap.docs[0];
      if (!first) return null;
      const url = (first.data().imageUrl as string)?.trim();
      return url || null;
    } catch {
      return null;
    }
  };

  /** Récupère toutes les URLs d'images OFF pour la galerie (image_front, image_url, + product.images). */
  const fetchOffAllImageUrls = async (ean: string): Promise<string[]> => {
    try {
      const { data } = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
      if (data.status !== 1 || !data.product) return [];
      const p = data.product;
      const urls = new Set<string>();
      for (const u of [p.image_front_url, p.image_url, p.image_small_url]) {
        if ((u || '').trim()) urls.add((u as string).trim());
      }
      const images = p.images as Record<string, { url?: string }> | undefined;
      if (images && typeof images === 'object') {
        for (const img of Object.values(images)) {
          if (img?.url?.trim()) urls.add(img.url.trim());
        }
      }
      return Array.from(urls);
    } catch {
      return [];
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
      if (!row.category && off.category) updates.category = off.category;
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

  /** Attribue les catégories manquantes : OFF d'abord, puis inférence par titre. */
  const handleAssignCategories = async () => {
    const withoutCategory = items.filter((r) => !r.category?.trim());
    if (withoutCategory.length === 0) {
      setImportMessage('Tous les articles ont déjà une catégorie.');
      setTimeout(() => setImportMessage(null), 4000);
      return;
    }
    setAssigningCategories(true);
    setAssignProgress(`0 / ${withoutCategory.length}`);
    let fromOff = 0;
    let fromTitle = 0;
    for (let i = 0; i < withoutCategory.length; i++) {
      const row = withoutCategory[i];
      setAssignProgress(`${i + 1} / ${withoutCategory.length}`);
      let category: ProductCategory | null = null;
      const off = await fetchOffByEan(row.ean);
      if (off.category) {
        category = off.category;
        fromOff++;
      }
      if (!category) category = inferCategoryFromTitle(row.title);
      if (category) {
        if (!off.category) fromTitle++;
        await updateDoc(doc(db, 'productCatalog', row.ean), {
          category,
          lastUpdated: new Date().toISOString(),
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setAssigningCategories(false);
    setAssignProgress(null);
    setImportMessage(
      `Catégories : ${fromOff + fromTitle} attribuées (OFF : ${fromOff}, titre : ${fromTitle}). ${withoutCategory.length - fromOff - fromTitle} sans correspondance.`
    );
    setTimeout(() => setImportMessage(null), 7000);
  };

  /** Met à jour en une passe les articles qui ont au moins un champ manquant (données OFF + catégorie titre + image affiches/Google/OFF). */
  const handleUpdateMissingData = async () => {
    const needsUpdate = items.filter(
      (r) => !r.brand?.trim() || !r.weight?.trim() || !r.category?.trim() || !r.imageUrl?.trim()
    );
    if (needsUpdate.length === 0) {
      setImportMessage('Aucun article à mettre à jour (toutes les données sont renseignées).');
      setTimeout(() => setImportMessage(null), 4000);
      return;
    }
    const GOOGLE_LIMIT_PER_RUN = 80;
    setUpdatingMissing(true);
    setUpdateProgress(`0 / ${needsUpdate.length}`);
    let updated = 0;
    let googleUsed = 0;
    for (let i = 0; i < needsUpdate.length; i++) {
      const row = needsUpdate[i];
      setUpdateProgress(`${i + 1} / ${needsUpdate.length}`);
      const updates: Partial<CatalogProduct> = { lastUpdated: new Date().toISOString() };
      const needsData = !row.brand?.trim() || !row.weight?.trim() || !row.category?.trim();
      const needsImage = !row.imageUrl?.trim();

      if (needsData) {
        const off = await fetchOffByEan(row.ean);
        if (!row.brand?.trim() && off.brand) updates.brand = off.brand;
        if (!row.weight?.trim() && off.weight) updates.weight = off.weight;
        if (!row.category?.trim() && off.category) updates.category = off.category;
        if (!row.category?.trim() && !updates.category) {
          const fromTitle = inferCategoryFromTitle(row.title);
          if (fromTitle) updates.category = fromTitle;
        }
      }

      if (needsImage) {
        let url: string | null = await getImageFromAffiches(row.ean);
        if (!url && googleUsed < GOOGLE_LIMIT_PER_RUN) {
          try {
            url = await ImageSearchService.searchImage(row.ean, row.title);
            if (url) googleUsed++;
          } catch {
            //
          }
        }
        if (!url) url = await fetchOffImageUrl(row.ean);
        if (url) updates.imageUrl = url;
      }

      const hasUpdates = Object.keys(updates).length > 1;
      if (hasUpdates) {
        const toWrite = sanitizeForFirestore({ ...row, ...updates });
        await setDoc(doc(db, 'productCatalog', row.ean), toWrite);
        updated++;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    setUpdatingMissing(false);
    setUpdateProgress(null);
    setImportMessage(
      `Données manquantes : ${updated} article(s) mis à jour sur ${needsUpdate.length} traités. Relancez si besoin.`
    );
    setTimeout(() => setImportMessage(null), 7000);
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
          size="sm"
          onClick={handleUpdateMissingData}
          disabled={updatingMissing || items.length === 0}
          title="Remplir marque, poids, catégorie et image manquants (OFF, affiches, Google)"
          className="bg-[#6F73F3] hover:bg-[#5F64EE] text-white rounded-lg"
        >
          {updatingMissing ? `Mise à jour… ${updateProgress ?? ''}` : 'Mettre à jour les données manquantes'}
        </Button>
      </div>
      {(importMessage || (updatingMissing && updateProgress)) && (
        <p className={`text-sm ${importMessage?.startsWith('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
          {updatingMissing && updateProgress ? `Mise à jour des données… ${updateProgress}` : importMessage}
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
                      <button
                        type="button"
                        onClick={() => openSheet(row, 'view')}
                        className="block rounded-lg border border-slate-200 overflow-hidden hover:ring-2 hover:ring-[#6F73F3] focus:outline-none focus:ring-2 focus:ring-[#6F73F3]"
                        title="Ouvrir la fiche article"
                      >
                        <img
                          src={row.imageUrl}
                          alt=""
                          className="h-12 w-12 object-contain"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openSheet(row, 'view')}
                        className="h-12 w-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 text-xs hover:bg-slate-100"
                        title="Ouvrir la fiche article"
                      >
                        —
                      </button>
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

      {/* Product sheet modal — layout type fiche produit (image gauche, infos droite) */}
      <Modal
        isOpen={sheetModalOpen}
        onClose={closeSheet}
        title="Fiche article"
        size="xl"
      >
        {selectedArticle && (
          <div className="rounded-2xl overflow-hidden bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Colonne gauche : image */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-center min-h-[240px]">
                {!galleryOpen ? (
                  <button
                    type="button"
                    onClick={openImageGallery}
                    className="w-full h-full min-h-[200px] rounded-lg overflow-hidden flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#6F73F3] focus:ring-offset-2"
                  >
                    {selectedArticle.imageUrl ? (
                      <img
                        src={selectedArticle.imageUrl}
                        alt=""
                        className="max-h-64 w-full object-contain"
                      />
                    ) : (
                      <span className="text-slate-400 text-sm">Cliquer pour ouvrir la galerie</span>
                    )}
                  </button>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {galleryLoading ? 'Chargement…' : `${galleryUrls.length} image(s)`}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setGalleryOpen(false)}>
                        Fermer
                      </Button>
                    </div>
                    {!galleryLoading && (
                      <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                        {galleryUrls.map(({ url, source }) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => selectGalleryImage(url)}
                            className="rounded-lg border-2 border-slate-200 hover:border-[#6F73F3] overflow-hidden bg-white"
                          >
                            <img src={url} alt="" className="w-full aspect-square object-contain" />
                            <span className="block text-xs text-slate-500 py-0.5">{source}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!galleryLoading && galleryUrls.length === 0 && (
                      <p className="text-sm text-slate-500">Aucune image trouvée.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Colonne droite : infos */}
              <div className="flex flex-col gap-4">
                <div>
                  {sheetMode === 'edit' ? (
                    <Input
                      value={editForm.title ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="text-lg font-semibold border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0"
                      placeholder="Titre"
                    />
                  ) : (
                    <h2 className="text-lg font-semibold text-slate-900">{selectedArticle.title || '—'}</h2>
                  )}
                  {sheetMode === 'edit' ? (
                    <Input
                      value={editForm.brand ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                      className="mt-0.5 text-sm text-slate-600 border-0 border-b border-slate-100 rounded-none px-0 focus-visible:ring-0"
                      placeholder="Marque"
                    />
                  ) : (
                    <p className="text-sm text-slate-600 mt-0.5">{selectedArticle.brand ?? '—'}</p>
                  )}
                </div>

                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">EAN</div>
                <p className="text-slate-900 font-mono text-sm">{selectedArticle.ean}</p>

                <div className="flex flex-wrap gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Poids</div>
                    {sheetMode === 'edit' ? (
                      <Input
                        value={editForm.weight ?? ''}
                        onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                        placeholder="500g, 1kg"
                        className="rounded-lg border-slate-200 w-24"
                      />
                    ) : (
                      <p className="text-slate-900 font-medium">{selectedArticle.weight ?? '—'}</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">Catégorie</div>
                    {sheetMode === 'edit' ? (
                      <select
                        value={editForm.category ?? ''}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            category: (e.target.value || undefined) as ProductCategory | undefined,
                          }))
                        }
                        className="h-9 rounded-lg border border-slate-200 px-3 text-sm min-w-[140px]"
                      >
                        <option value="">Choisir…</option>
                        {PRODUCT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      selectedArticle.category ? (
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_BADGE_COLORS[selectedArticle.category] ?? 'bg-slate-100 text-slate-700'}`}
                        >
                          {selectedArticle.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )
                    )}
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                  <Button variant="outline" onClick={closeSheet} className="rounded-lg">
                    Fermer
                  </Button>
                  {sheetMode === 'edit' && (
                    <Button onClick={handleSaveSheet} disabled={saving} className="rounded-lg bg-[#6F73F3] hover:bg-[#5F64EE] text-white">
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  )}
                  {sheetMode === 'view' && (
                    <Button onClick={() => setSheetMode('edit')} className="rounded-lg bg-[#6F73F3] hover:bg-[#5F64EE] text-white">
                      Modifier
                    </Button>
                  )}
                </div>
              </div>
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
