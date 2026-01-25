import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import { ImageSearchService } from '../services/ImageSearchService';
import Modal from '../components/Modal';
import PromoScanner from '../components/PromoScanner';

type PromoItem = {
  id: string;
  ean: string;
  designation: string;
  imageUrl: string;
  promoType: string;
  priceBuy: string;
  priceSell: string;
  margin: string;
  marginLocked: boolean;
  stock: string;
  groupId?: string;
  isMain?: boolean;
};

type PromoGroup = {
  id: string;
  name: string;
  tg: string;
  items: PromoItem[];
  mainItemId?: string;
};

const promoTypes = [
  '20% TEL',
  'BRII30%',
  'BRII34%',
  'BRII60%/2E'
];

const tgOptions = ['TG1', 'TG2', 'TG3', 'TG4', 'TG5', 'TG6', 'TG7', 'TG8', 'TG9'];

const createEmptyItem = (): PromoItem => ({
  id: crypto.randomUUID(),
  ean: '',
  designation: '',
  imageUrl: '',
  promoType: '',
  priceBuy: '',
  priceSell: '',
  margin: '',
  marginLocked: false,
  stock: ''
});

const computeMargin = (priceBuy: string, priceSell: string) => {
  const buy = parseFloat(priceBuy.replace(',', '.'));
  const sell = parseFloat(priceSell.replace(',', '.'));
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || sell <= 0) {
    return '';
  }
  const margin = ((sell - buy) / sell) * 100;
  return `${Math.round(margin * 10) / 10}`;
};

const Promos: React.FC = () => {
  const [catalogName, setCatalogName] = useState('Dépenser Moins 1');
  const [catalogStart, setCatalogStart] = useState('2026-01-27');
  const [catalogEnd, setCatalogEnd] = useState('2026-02-08');

  const [items, setItems] = useState<PromoItem[]>([createEmptyItem()]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [promoGroups, setPromoGroups] = useState<PromoGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [promoName, setPromoName] = useState('');
  const [promoTg, setPromoTg] = useState('TG1');

  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogSaveMessage, setCatalogSaveMessage] = useState('');
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [eanWarning, setEanWarning] = useState('');
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  const isLoadingCatalogRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  const normalizeEan = (value: string) => value.replace(/\D/g, '');
  const isDuplicateEan = (value: string, excludeId?: string) => {
    const eanValue = normalizeEan(value);
    if (!eanValue) return false;
    return items.some((item) => item.ean.trim() === eanValue && item.id !== excludeId);
  };


  useEffect(() => {
    const loadLatestCatalog = async () => {
      try {
        isLoadingCatalogRef.current = true;
        const q = query(collection(db, 'promoCatalogs'), orderBy('createdAt', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;
        const docSnap = snapshot.docs[0];
        const data = docSnap.data() as {
          name?: string;
          startDate?: string;
          endDate?: string;
          items?: PromoItem[];
          promoGroups?: PromoGroup[];
        };
        setCatalogId(docSnap.id);
        setCatalogName(data.name || '');
        setCatalogStart(data.startDate || '');
        setCatalogEnd(data.endDate || '');
        setItems(data.items || [createEmptyItem()]);
        const loadedGroups = data.promoGroups || [];
        setPromoGroups(loadedGroups);
        // Initialiser expandedGroups avec tous les groupes
        setExpandedGroups(new Set(loadedGroups.map((g) => g.id)));
      } catch (error) {
        console.error('Erreur chargement catalogue:', error);
      } finally {
        isLoadingCatalogRef.current = false;
      }
    };

    loadLatestCatalog();
  }, []);

  const fetchOpenFoodData = useCallback(async (barcode: string) => {
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        const designation = product.product_name_fr || product.product_name || product.generic_name || '';
        const googleImage = await ImageSearchService.searchImage(barcode, designation);
        const offImage =
          product.image_url ||
          product.image_front_url ||
          product.image_front_small_url ||
          product.image_small_url ||
          '';
        return {
          designation,
          imageUrl: googleImage || offImage || ''
        };
      }
      const googleImage = await ImageSearchService.searchImage(barcode);
      return {
        designation: '',
        imageUrl: googleImage || ''
      };
    } catch (error) {
      console.warn('Open Food Facts error', error);
      return null;
    }
  }, []);

  const fetchOpenFoodDesignation = useCallback(async (barcode: string) => {
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        return product.product_name_fr || product.product_name || product.generic_name || '';
      }
      return '';
    } catch (error) {
      console.warn('Open Food Facts name error', error);
      return '';
    }
  }, []);

  const handleEanLookup = useCallback(
    async (id: string, ean: string) => {
      const cleaned = normalizeEan(ean);
      if (!/^\d{13}$/.test(cleaned)) {
        return;
      }
      if (isDuplicateEan(cleaned, id)) {
        setEanWarning(`EAN déjà ajouté: ${cleaned}`);
        updateItem(id, { ean: '', designation: '', imageUrl: '' });
        window.setTimeout(() => setEanWarning(''), 1800);
        return;
      }
      const data = await fetchOpenFoodData(cleaned);
      if (!data) {
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ean: cleaned, designation: data.designation || item.designation, imageUrl: data.imageUrl || item.imageUrl }
            : item
        )
      );
    },
    [fetchOpenFoodData]
  );

  const updateItem = (id: string, updates: Partial<PromoItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...updates };
        if (!next.marginLocked && (updates.priceBuy !== undefined || updates.priceSell !== undefined)) {
          next.margin = computeMargin(next.priceBuy, next.priceSell);
        }
        return next;
      })
    );
  };

  const addRow = () => setItems((prev) => [...prev, createEmptyItem()]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const createPromoGroup = () => {
    if (!promoName || selectedIds.size === 0) return;
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) return;
    
    const groupId = crypto.randomUUID();
    const mainItemId = selectedItems[0].id;
    
    // Marquer les items avec le groupId et le premier comme main
    setItems((prev) =>
      prev.map((item) => {
        if (selectedIds.has(item.id)) {
          return {
            ...item,
            groupId,
            isMain: item.id === mainItemId
          };
        }
        return item;
      })
    );
    
    setPromoGroups((prev) => [
      ...prev,
      {
        id: groupId,
        name: promoName,
        tg: promoTg,
        items: selectedItems,
        mainItemId
      }
    ]);
    setExpandedGroups((prev) => new Set(prev).add(groupId));
    setSelectedIds(new Set());
    setPromoName('');
    setPromoTg('TG1');
  };

  // Appliquer la promo du main à tous les items du groupe
  const applyPromoToGroup = (groupId: string, promoType: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.groupId === groupId) {
          return { ...item, promoType };
        }
        return item;
      })
    );
  };

  // Toggle l'expansion d'un groupe
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Gérer l'ajout d'un produit scanné
  const handleProductScanned = (ean: string, designation: string, imageUrl: string) => {
    const cleaned = normalizeEan(ean);
    if (!cleaned || !/^\d{13}$/.test(cleaned)) {
      setEanWarning('EAN invalide');
      setTimeout(() => setEanWarning(''), 2000);
      return;
    }
    
    if (isDuplicateEan(cleaned)) {
      setEanWarning(`EAN déjà ajouté: ${cleaned}`);
      setTimeout(() => setEanWarning(''), 2000);
      return;
    }
    
    const newItem: PromoItem = {
      ...createEmptyItem(),
      ean: cleaned,
      designation: designation || '',
      imageUrl: imageUrl || ''
    };
    
    setItems((prev) => [...prev, newItem]);
  };

  const removeSelectedItems = () => {
    if (selectedIds.size === 0) return;
    setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const handleStockBlur = (index: number, value: string) => {
    if (!value.trim()) return;
    if (index === items.length - 1) {
      addRow();
    }
  };

  const refreshImages = async () => {
    if (refreshingImages) return;
    setRefreshingImages(true);
    setRefreshMessage('');
    try {
      const updated = [...items];
      for (let i = 0; i < updated.length; i += 1) {
        const item = updated[i];
        if (!item.ean || item.imageUrl) continue;
        if (!/^\d{13}$/.test(item.ean)) continue;
        let designation = item.designation;
        if (!designation) {
          designation = await fetchOpenFoodDesignation(item.ean);
          updated[i] = { ...updated[i], designation };
        }
        const imageUrl = await ImageSearchService.searchImage(item.ean, designation);
        if (imageUrl) {
          updated[i] = { ...updated[i], imageUrl };
          setItems([...updated]);
        } else {
          try {
            const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${item.ean}.json`);
            if (response.data.status === 1 && response.data.product) {
              const product = response.data.product;
              const offImage =
                product.image_url ||
                product.image_front_url ||
                product.image_front_small_url ||
                product.image_small_url ||
                '';
              if (offImage) {
                updated[i] = { ...updated[i], imageUrl: offImage };
                setItems([...updated]);
              }
            }
          } catch (error) {
            console.warn('Open Food Facts image error', error);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setRefreshMessage('Actualisation terminée.');
    } catch (error) {
      console.error('Erreur actualisation images:', error);
      setRefreshMessage('Erreur lors de l’actualisation.');
    } finally {
      setRefreshingImages(false);
      window.setTimeout(() => setRefreshMessage(''), 2000);
    }
  };

  const saveCatalog = async (showMessage: boolean) => {
    if (!catalogName.trim()) {
      if (showMessage) {
        setCatalogSaveMessage('Nom de catalogue obligatoire.');
      }
      return;
    }
    if (showMessage) {
      setCatalogSaving(true);
      setCatalogSaveMessage('');
    }
    try {
      if (catalogId) {
        await updateDoc(doc(db, 'promoCatalogs', catalogId), {
          name: catalogName.trim(),
          startDate: catalogStart,
          endDate: catalogEnd,
          items,
          promoGroups,
          updatedAt: new Date().toISOString()
        });
      } else {
        const createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'promoCatalogs'), {
          name: catalogName.trim(),
          startDate: catalogStart,
          endDate: catalogEnd,
          items,
          promoGroups,
          createdAt
        });
        setCatalogId(docRef.id);
      }
      if (showMessage) {
        setCatalogSaveMessage('Catalogue enregistré.');
      } else {
        setAutoSaveStatus('Auto-enregistré');
        window.setTimeout(() => setAutoSaveStatus(''), 1200);
      }
    } catch (error) {
      console.error('Erreur enregistrement catalogue:', error);
      if (showMessage) {
        setCatalogSaveMessage('Erreur lors de l’enregistrement.');
      }
    } finally {
      if (showMessage) {
        setCatalogSaving(false);
      }
    }
  };

  const handleSaveCatalog = async () => {
    await saveCatalog(true);
  };

  useEffect(() => {
    if (isLoadingCatalogRef.current) return;
    if (!catalogName.trim()) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      saveCatalog(false);
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [catalogName, catalogStart, catalogEnd, items, promoGroups]);

  const selectedCount = selectedIds.size;
  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);

  // Organiser les items par groupe pour l'affichage
  const organizedItems = useMemo(() => {
    const grouped: { groupId: string; main: PromoItem; others: PromoItem[] }[] = [];
    const ungrouped: PromoItem[] = [];
    const processedIds = new Set<string>();

    // Traiter les items groupés
    promoGroups.forEach((group) => {
      const main = items.find((item) => item.id === group.mainItemId && item.groupId === group.id);
      const others = items.filter(
        (item) => item.groupId === group.id && item.id !== group.mainItemId
      );
      if (main) {
        grouped.push({ groupId: group.id, main, others });
        processedIds.add(main.id);
        others.forEach((item) => processedIds.add(item.id));
      }
    });

    // Traiter les items non groupés
    items.forEach((item) => {
      if (!processedIds.has(item.id)) {
        ungrouped.push(item);
      }
    });

    return { grouped, ungrouped };
  }, [items, promoGroups]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <header className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Saisie des promotions</h1>
            <p className="text-sm text-slate-500">Catalogue défini avant saisie • regroupement en promos ensuite</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/promos"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retour au calendrier
            </Link>
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Importer un fichier
            </button>
            <button
              onClick={refreshImages}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={refreshingImages}
            >
              {refreshingImages ? 'Actualisation…' : 'Actualiser les photos'}
            </button>
            <button
              onClick={handleSaveCatalog}
              className="rounded-lg bg-[#6F73F3] px-4 py-2 text-sm font-medium text-white hover:bg-[#5F64EE] disabled:opacity-60"
              disabled={catalogSaving}
            >
              {catalogSaving ? 'Enregistrement...' : 'Enregistrer le catalogue'}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Catalogue</label>
            <input
              value={catalogName}
              onChange={(event) => setCatalogName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Nom du catalogue"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Début (mardi)</label>
            <input
              type="date"
              value={catalogStart}
              onChange={(event) => setCatalogStart(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Fin (lundi)</label>
            <input
              type="date"
              value={catalogEnd}
              onChange={(event) => setCatalogEnd(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
        <div className="mt-3 min-h-[20px] text-sm text-slate-600">
          {catalogSaveMessage || autoSaveStatus || eanWarning || refreshMessage}
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tableur des articles</h2>
            <p className="text-sm text-slate-500">Saisie EAN → auto-remplissage • promo + prix + stock</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={removeSelectedItems}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              disabled={selectedIds.size === 0}
              aria-label="Supprimer les articles sélectionnés"
              title="Supprimer les articles sélectionnés"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M9 6V4h6v2m-8 4v6m4-6v6m4-6v6M5 6l1 14h12l1-14" />
              </svg>
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="rounded-lg bg-[#6F73F3] px-3 py-2 text-sm font-medium text-white hover:bg-[#5F64EE]"
            >
              Scanner
            </button>
            <button
              onClick={addRow}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ajouter une ligne
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Coller une liste
            </button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    Sélection
                  </label>
                </th>
                <th className="px-4 py-3 text-left font-semibold">EAN</th>
                <th className="px-4 py-3 text-left font-semibold">Désignation</th>
                <th className="px-4 py-3 text-left font-semibold">Type promo</th>
                <th className="px-4 py-3 text-left font-semibold">P3N</th>
                <th className="px-4 py-3 text-left font-semibold">PVH</th>
                <th className="px-4 py-3 text-left font-semibold">Marge %</th>
                <th className="px-4 py-3 text-left font-semibold">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Afficher les groupes */}
              {organizedItems.grouped.map(({ groupId, main, others }) => {
                const group = promoGroups.find((g) => g.id === groupId);
                const isExpanded = expandedGroups.has(groupId);
                const groupItems = [main, ...others];
                const groupIndex = items.findIndex((i) => i.id === main.id);

                return (
                  <React.Fragment key={groupId}>
                    {/* Ligne principale du groupe */}
                    <tr className="bg-blue-50 hover:bg-blue-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleGroup(groupId)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(main.id)}
                            onChange={() => toggleSelected(main.id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3" colSpan={7}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700">
                            {group?.name || 'Groupe'} ({groupItems.length} article{groupItems.length > 1 ? 's' : ''})
                          </span>
                          {main.isMain && (
                            <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded">MAIN</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Ligne du produit main */}
                    <tr key={main.id} className="bg-blue-50/50 hover:bg-blue-100/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(main.id)}
                          onChange={() => toggleSelected(main.id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={main.ean}
                          onChange={(event) => {
                            const digits = normalizeEan(event.target.value);
                            updateItem(main.id, { ean: digits });
                            if (digits.length === 13) {
                              handleEanLookup(main.id, digits);
                            }
                          }}
                          onBlur={() => handleEanLookup(main.id, main.ean)}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="13 chiffres"
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          {main.imageUrl ? (
                            <img src={main.imageUrl} alt="" className="h-9 w-9 rounded-md border object-contain" />
                          ) : (
                            <div className="h-9 w-9 rounded-md border border-dashed border-slate-200 bg-slate-50" />
                          )}
                          <input
                            value={main.designation}
                            onChange={(event) => updateItem(main.id, { designation: event.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder="Nom du produit"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={main.promoType}
                          onChange={(event) => {
                            const promoType = event.target.value;
                            updateItem(main.id, { promoType });
                            applyPromoToGroup(groupId, promoType);
                          }}
                          className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="">Choisir</option>
                          {promoTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={main.priceBuy}
                          onChange={(event) => updateItem(main.id, { priceBuy: event.target.value })}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="P3N"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={main.priceSell}
                          onChange={(event) => updateItem(main.id, { priceSell: event.target.value })}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="PVH"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={main.margin}
                          onChange={(event) =>
                            updateItem(main.id, { margin: event.target.value, marginLocked: true })
                          }
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="%"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={main.stock}
                          onChange={(event) => updateItem(main.id, { stock: event.target.value })}
                          onBlur={(event) => handleStockBlur(groupIndex, event.target.value)}
                          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="UVC"
                        />
                      </td>
                    </tr>
                    {/* Lignes des autres produits du groupe (si expanded) */}
                    {isExpanded &&
                      others.map((item) => {
                        const itemIndex = items.findIndex((i) => i.id === item.id);
                        return (
                          <tr key={item.id} className="bg-slate-50/50 hover:bg-slate-100/50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelected(item.id)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.ean}
                                onChange={(event) => {
                                  const digits = normalizeEan(event.target.value);
                                  updateItem(item.id, { ean: digits });
                                  if (digits.length === 13) {
                                    handleEanLookup(item.id, digits);
                                  }
                                }}
                                onBlur={() => handleEanLookup(item.id, item.ean)}
                                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="13 chiffres"
                              />
                            </td>
                            <td className="px-4 py-3 min-w-[220px]">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt="" className="h-9 w-9 rounded-md border object-contain" />
                                ) : (
                                  <div className="h-9 w-9 rounded-md border border-dashed border-slate-200 bg-slate-50" />
                                )}
                                <input
                                  value={item.designation}
                                  onChange={(event) => updateItem(item.id, { designation: event.target.value })}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                  placeholder="Nom du produit"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={item.promoType}
                                onChange={(event) => updateItem(item.id, { promoType: event.target.value })}
                                className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                              >
                                <option value="">Choisir</option>
                                {promoTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.priceBuy}
                                onChange={(event) => updateItem(item.id, { priceBuy: event.target.value })}
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="P3N"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.priceSell}
                                onChange={(event) => updateItem(item.id, { priceSell: event.target.value })}
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="PVH"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.margin}
                                onChange={(event) =>
                                  updateItem(item.id, { margin: event.target.value, marginLocked: true })
                                }
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="%"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={item.stock}
                                onChange={(event) => updateItem(item.id, { stock: event.target.value })}
                                onBlur={(event) => handleStockBlur(itemIndex, event.target.value)}
                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="UVC"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              {/* Afficher les items non groupés */}
              {organizedItems.ungrouped.map((item, index) => {
                const itemIndex = items.findIndex((i) => i.id === item.id);
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.ean}
                        onChange={(event) => {
                          const digits = normalizeEan(event.target.value);
                          updateItem(item.id, { ean: digits });
                          if (digits.length === 13) {
                            handleEanLookup(item.id, digits);
                          }
                        }}
                        onBlur={() => handleEanLookup(item.id, item.ean)}
                        className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="13 chiffres"
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-9 w-9 rounded-md border object-contain" />
                        ) : (
                          <div className="h-9 w-9 rounded-md border border-dashed border-slate-200 bg-slate-50" />
                        )}
                        <input
                          value={item.designation}
                          onChange={(event) => updateItem(item.id, { designation: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Nom du produit"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={item.promoType}
                        onChange={(event) => updateItem(item.id, { promoType: event.target.value })}
                        className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">Choisir</option>
                        {promoTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.priceBuy}
                        onChange={(event) => updateItem(item.id, { priceBuy: event.target.value })}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="P3N"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.priceSell}
                        onChange={(event) => updateItem(item.id, { priceSell: event.target.value })}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="PVH"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.margin}
                        onChange={(event) =>
                          updateItem(item.id, { margin: event.target.value, marginLocked: true })
                        }
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="%"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.stock}
                        onChange={(event) => updateItem(item.id, { stock: event.target.value })}
                        onBlur={(event) => handleStockBlur(itemIndex, event.target.value)}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="UVC"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden overflow-x-auto p-4">
          {/* Bouton de scan avant la liste sur mobile */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 rounded-lg bg-[#6F73F3] px-3 py-2 text-sm font-medium text-white hover:bg-[#5F64EE]"
            >
              Scanner un produit
            </button>
            <button
              onClick={addRow}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Ajouter manuellement
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                </th>
                <th className="px-2 py-2 text-left text-xs font-semibold">EAN</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">Photo</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">Désignation</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">Type</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">P3N</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">PVH</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">Marge</th>
                <th className="px-2 py-2 text-left text-xs font-semibold">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Afficher les groupes sur mobile */}
              {organizedItems.grouped.map(({ groupId, main, others }) => {
                const group = promoGroups.find((g) => g.id === groupId);
                const isExpanded = expandedGroups.has(groupId);
                const groupItems = [main, ...others];
                const groupIndex = items.findIndex((i) => i.id === main.id);

                return (
                  <React.Fragment key={groupId}>
                    {/* Ligne principale du groupe */}
                    <tr className="bg-blue-50">
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleGroup(groupId)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            <svg
                              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(main.id)}
                            onChange={() => toggleSelected(main.id)}
                            className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2" colSpan={8}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-700">
                            {group?.name || 'Groupe'} ({groupItems.length})
                          </span>
                          {main.isMain && (
                            <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded">MAIN</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Ligne du produit main */}
                    <tr key={main.id} className="bg-blue-50/50">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(main.id)}
                          onChange={() => toggleSelected(main.id)}
                          className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={main.ean}
                          onChange={(event) => {
                            const digits = normalizeEan(event.target.value);
                            updateItem(main.id, { ean: digits });
                            if (digits.length === 13) {
                              handleEanLookup(main.id, digits);
                            }
                          }}
                          onBlur={() => handleEanLookup(main.id, main.ean)}
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="EAN"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {main.imageUrl ? (
                          <img src={main.imageUrl} alt="" className="h-8 w-8 rounded border object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded border border-dashed border-slate-200 bg-slate-50" />
                        )}
                      </td>
                      <td className="px-2 py-2 min-w-[120px]">
                        <input
                          value={main.designation}
                          onChange={(event) => updateItem(main.id, { designation: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Désignation"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={main.promoType}
                          onChange={(event) => {
                            const promoType = event.target.value;
                            updateItem(main.id, { promoType });
                            applyPromoToGroup(groupId, promoType);
                          }}
                          className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="">-</option>
                          {promoTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={main.priceBuy}
                          onChange={(event) => updateItem(main.id, { priceBuy: event.target.value })}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="P3N"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={main.priceSell}
                          onChange={(event) => updateItem(main.id, { priceSell: event.target.value })}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="PVH"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={main.margin}
                          onChange={(event) => updateItem(main.id, { margin: event.target.value, marginLocked: true })}
                          className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="%"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={main.stock}
                          onChange={(event) => updateItem(main.id, { stock: event.target.value })}
                          onBlur={(event) => handleStockBlur(groupIndex, event.target.value)}
                          className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="UVC"
                        />
                      </td>
                    </tr>
                    {/* Lignes des autres produits du groupe (si expanded) */}
                    {isExpanded &&
                      others.map((item) => {
                        const itemIndex = items.findIndex((i) => i.id === item.id);
                        return (
                          <tr key={item.id} className="bg-slate-50/50">
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelected(item.id)}
                                className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={item.ean}
                                onChange={(event) => {
                                  const digits = normalizeEan(event.target.value);
                                  updateItem(item.id, { ean: digits });
                                  if (digits.length === 13) {
                                    handleEanLookup(item.id, digits);
                                  }
                                }}
                                onBlur={() => handleEanLookup(item.id, item.ean)}
                                className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="EAN"
                              />
                            </td>
                            <td className="px-2 py-2">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="h-8 w-8 rounded border object-contain" />
                              ) : (
                                <div className="h-8 w-8 rounded border border-dashed border-slate-200 bg-slate-50" />
                              )}
                            </td>
                            <td className="px-2 py-2 min-w-[120px]">
                              <input
                                value={item.designation}
                                onChange={(event) => updateItem(item.id, { designation: event.target.value })}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="Désignation"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <select
                                value={item.promoType}
                                onChange={(event) => updateItem(item.id, { promoType: event.target.value })}
                                className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                              >
                                <option value="">-</option>
                                {promoTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={item.priceBuy}
                                onChange={(event) => updateItem(item.id, { priceBuy: event.target.value })}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="P3N"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={item.priceSell}
                                onChange={(event) => updateItem(item.id, { priceSell: event.target.value })}
                                className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="PVH"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={item.margin}
                                onChange={(event) => updateItem(item.id, { margin: event.target.value, marginLocked: true })}
                                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="%"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={item.stock}
                                onChange={(event) => updateItem(item.id, { stock: event.target.value })}
                                onBlur={(event) => {
                                  if (itemIndex !== -1) {
                                    handleStockBlur(itemIndex, event.target.value);
                                  }
                                }}
                                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                                placeholder="UVC"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              {/* Afficher les items non groupés sur mobile */}
              {organizedItems.ungrouped.map((item) => {
                const itemIndex = items.findIndex((i) => i.id === item.id);
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.ean}
                        onChange={(event) => {
                          const digits = normalizeEan(event.target.value);
                          updateItem(item.id, { ean: digits });
                          if (digits.length === 13) {
                            handleEanLookup(item.id, digits);
                          }
                        }}
                        onBlur={() => handleEanLookup(item.id, item.ean)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="EAN"
                      />
                    </td>
                    <td className="px-2 py-2">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="h-8 w-8 rounded border object-contain" />
                      ) : (
                        <div className="h-8 w-8 rounded border border-dashed border-slate-200 bg-slate-50" />
                      )}
                    </td>
                    <td className="px-2 py-2 min-w-[120px]">
                      <input
                        value={item.designation}
                        onChange={(event) => updateItem(item.id, { designation: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Désignation"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={item.promoType}
                        onChange={(event) => updateItem(item.id, { promoType: event.target.value })}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">-</option>
                        {promoTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.priceBuy}
                        onChange={(event) => updateItem(item.id, { priceBuy: event.target.value })}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="P3N"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.priceSell}
                        onChange={(event) => updateItem(item.id, { priceSell: event.target.value })}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="PVH"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.margin}
                        onChange={(event) => updateItem(item.id, { margin: event.target.value, marginLocked: true })}
                        className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="%"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={item.stock}
                        onChange={(event) => updateItem(item.id, { stock: event.target.value })}
                        onBlur={(event) => {
                          if (itemIndex !== -1) {
                            handleStockBlur(itemIndex, event.target.value);
                          }
                        }}
                        className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="UVC"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Créer une promo avec la sélection</h3>
          <p className="text-sm text-slate-500">Sélection actuelle : {selectedCount} article(s)</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input
              value={promoName}
              onChange={(event) => setPromoName(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              placeholder="Nom de la promo"
            />
            <select
              value={promoTg}
              onChange={(event) => setPromoTg(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {tgOptions.map((tg) => (
                <option key={tg} value={tg}>
                  {tg}
                </option>
              ))}
            </select>
            <button
              onClick={createPromoGroup}
              className="rounded-lg bg-[#6F73F3] px-4 py-2 text-sm font-medium text-white hover:bg-[#5F64EE] disabled:opacity-50"
              disabled={!promoName || selectedCount === 0}
            >
              Créer la promo
            </button>
          </div>
          {selectedItems.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-9 w-9 rounded-md border object-contain" />
                  ) : (
                    <div className="h-9 w-9 rounded-md border border-dashed border-slate-200 bg-slate-50" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{item.designation || 'Produit sans nom'}</div>
                    <div className="text-xs text-slate-500">{item.ean}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Promos créées</h3>
          {promoGroups.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune promo créée pour l'instant.</p>
          ) : (
            promoGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{group.name}</div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{group.tg}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {catalogName} • {catalogStart} → {catalogEnd}
                </div>
                <div className="text-xs text-slate-600">{group.items.length} article(s)</div>
              </div>
            ))
          )}
        </div>
      </section>


      <Modal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title="Scanner un produit"
      >
        <PromoScanner 
          onClose={() => setIsScannerOpen(false)} 
          onProductScanned={handleProductScanned}
        />
      </Modal>
    </div>
  );
};

export default Promos;
