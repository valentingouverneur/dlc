import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { addDoc, collection, doc, getDocs, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import { ImageSearchService } from '../services/ImageSearchService';

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
};

type PromoGroup = {
  id: string;
  name: string;
  tg: string;
  items: PromoItem[];
};

const promoTypes = [
  'Réduction immédiate',
  '-34%',
  '-68% 2e moins cher',
  '2e à -60%',
  'Lot x2',
  'Ticket',
  'Autre'
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

  const [promoName, setPromoName] = useState('');
  const [promoTg, setPromoTg] = useState('TG1');

  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState<'scan' | 'form'>('scan');
  const [mobileItem, setMobileItem] = useState<PromoItem>(createEmptyItem());
  const [mobileLoading, setMobileLoading] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogSaveMessage, setCatalogSaveMessage] = useState('');
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [eanWarning, setEanWarning] = useState('');
  const [scanSessionEans, setScanSessionEans] = useState<Set<string>>(new Set());
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ ean: string; at: number }>({ ean: '', at: 0 });
  const scanLockRef = useRef(false);
  const isLoadingCatalogRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  const normalizeEan = (value: string) => value.replace(/\D/g, '');
  const isDuplicateEan = (value: string, excludeId?: string) => {
    const eanValue = normalizeEan(value);
    if (!eanValue) return false;
    return items.some((item) => item.ean.trim() === eanValue && item.id !== excludeId);
  };

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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
        setPromoGroups(data.promoGroups || []);
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
    setPromoGroups((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: promoName,
        tg: promoTg,
        items: selectedItems
      }
    ]);
    setSelectedIds(new Set());
    setPromoName('');
    setPromoTg('TG1');
  };

  const handleMobileScan = useCallback(async (decodedText: string) => {
    if (!/^\d{13}$/.test(decodedText)) {
      return;
    }
    if (scanSessionEans.has(decodedText)) {
      setScanMessage('EAN déjà scanné.');
      setTimeout(() => setScanMessage(''), 1500);
      return;
    }
    if (isDuplicateEan(decodedText)) {
      setScanMessage('EAN déjà ajouté.');
      setTimeout(() => setScanMessage(''), 1500);
      return;
    }
    const now = Date.now();
    if (scanLockRef.current) {
      return;
    }
    if (lastScanRef.current.ean === decodedText && now - lastScanRef.current.at < 5000) {
      return;
    }
    lastScanRef.current = { ean: decodedText, at: now };
    scanLockRef.current = true;
    setMobileLoading(true);
    const data = await fetchOpenFoodData(decodedText);
    const newItem: PromoItem = {
      ...createEmptyItem(),
      ean: decodedText,
      designation: data?.designation || '',
      imageUrl: data?.imageUrl || ''
    };
    setItems((prev) => [...prev, newItem]);
    setScanSessionEans((prev) => new Set(prev).add(decodedText));
    setMobileLoading(false);
    setScanMessage('Produit ajouté avec succès.');
    setTimeout(() => setScanMessage(''), 1500);
    window.setTimeout(() => {
      scanLockRef.current = false;
    }, 2500);
  }, [fetchOpenFoodData, isDuplicateEan, scanSessionEans]);

  useEffect(() => {
    if (!isMobile || !isScannerOpen) return;
    const html5Qr = new Html5Qrcode('promo-barcode-scanner');
    scannerRef.current = html5Qr;
    const startScanner = async () => {
      try {
        await html5Qr.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.777,
            disableFlip: true,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          handleMobileScan,
          () => undefined
        );
      } catch (error) {
        console.error('Erreur démarrage scanner:', error);
      }
    };
    startScanner();
    return () => {
      html5Qr
        .stop()
        .catch(() => undefined)
        .finally(() => {
          html5Qr.clear();
          scannerRef.current = null;
        });
    };
  }, [handleMobileScan, isMobile, isScannerOpen]);

  const addMobileItem = () => {
    const cleaned = normalizeEan(mobileItem.ean);
    if (cleaned && scanSessionEans.has(cleaned)) {
      setEanWarning(`EAN déjà scanné: ${cleaned}`);
      window.setTimeout(() => setEanWarning(''), 1800);
      return;
    }
    if (cleaned && isDuplicateEan(cleaned)) {
      setEanWarning(`EAN déjà ajouté: ${cleaned}`);
      window.setTimeout(() => setEanWarning(''), 1800);
      return;
    }
    setItems((prev) => [...prev, { ...mobileItem, id: crypto.randomUUID() }]);
    if (cleaned) {
      setScanSessionEans((prev) => new Set(prev).add(cleaned));
    }
    setMobileItem(createEmptyItem());
    setMobileStep('form');
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
          {items.map((item, index) => (
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
                      onBlur={(event) => handleStockBlur(index, event.target.value)}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="UVC"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3 p-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-lg border object-contain" />
                ) : (
                  <div className="h-12 w-12 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                )}
                <div className="flex-1 space-y-2">
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    placeholder="EAN"
                  />
                  <input
                    value={item.designation}
                    onChange={(event) => updateItem(item.id, { designation: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    placeholder="Désignation"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={item.priceBuy}
                  onChange={(event) => updateItem(item.id, { priceBuy: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  placeholder="P3N"
                />
                <input
                  value={item.priceSell}
                  onChange={(event) => updateItem(item.id, { priceSell: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  placeholder="PVH"
                />
                <input
                  value={item.margin}
                  onChange={(event) => updateItem(item.id, { margin: event.target.value, marginLocked: true })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  placeholder="Marge %"
                />
                <input
                  value={item.stock}
                  onChange={(event) => updateItem(item.id, { stock: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                  placeholder="Stock"
                />
              </div>
              <select
                value={item.promoType}
                onChange={(event) => updateItem(item.id, { promoType: event.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
              >
                <option value="">Type promo</option>
                {promoTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <button
                onClick={() => toggleSelected(item.id)}
                className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${
                  selectedIds.has(item.id)
                    ? 'bg-[#6F73F3] text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {selectedIds.has(item.id) ? 'Sélectionné' : 'Sélectionner pour promo'}
              </button>
            </div>
          ))}
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

      <section className="md:hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Saisie mobile (scan rapide)</h3>
        <p className="text-sm text-slate-500">
          Scanner en plein écran, ajout automatique à la liste, modification ensuite sur PC.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setScanSessionEans(new Set());
              setIsScannerOpen(true);
            }}
            className="flex-1 rounded-lg bg-[#6F73F3] px-3 py-2 text-sm font-medium text-white hover:bg-[#5F64EE]"
          >
            Scanner
          </button>
          <button
            onClick={() => setMobileStep('form')}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            Saisie manuelle
          </button>
        </div>

        {mobileStep === 'form' && (
          <div className="space-y-3">
            <input
              value={mobileItem.ean}
              onChange={(event) => {
                const digits = normalizeEan(event.target.value);
                setMobileItem((prev) => ({ ...prev, ean: digits }));
                if (digits.length === 13) {
                  handleEanLookup(mobileItem.id, digits);
                }
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="EAN"
            />
            <input
              value={mobileItem.designation}
              onChange={(event) => setMobileItem((prev) => ({ ...prev, designation: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Désignation"
            />
            <select
              value={mobileItem.promoType}
              onChange={(event) => setMobileItem((prev) => ({ ...prev, promoType: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Type promo</option>
              {promoTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={mobileItem.priceBuy}
                onChange={(event) =>
                  setMobileItem((prev) => ({
                    ...prev,
                    priceBuy: event.target.value,
                    margin: prev.marginLocked ? prev.margin : computeMargin(event.target.value, prev.priceSell)
                  }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="P3N"
              />
              <input
                value={mobileItem.priceSell}
                onChange={(event) =>
                  setMobileItem((prev) => ({
                    ...prev,
                    priceSell: event.target.value,
                    margin: prev.marginLocked ? prev.margin : computeMargin(prev.priceBuy, event.target.value)
                  }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="PVH"
              />
              <input
                value={mobileItem.margin}
                onChange={(event) =>
                  setMobileItem((prev) => ({ ...prev, margin: event.target.value, marginLocked: true }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Marge %"
              />
              <input
                value={mobileItem.stock}
                onChange={(event) => setMobileItem((prev) => ({ ...prev, stock: event.target.value }))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="Stock"
              />
            </div>
            <button
              onClick={addMobileItem}
              className="w-full rounded-lg bg-[#6F73F3] px-3 py-2 text-sm font-medium text-white hover:bg-[#5F64EE]"
            >
              Enregistrer
            </button>
          </div>
        )}
      </section>

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black">
          <style>{`
            #promo-barcode-scanner {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
            }
            #promo-barcode-scanner video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover;
            }
            #promo-barcode-scanner__dashboard,
            #promo-barcode-scanner__header_message,
            #promo-barcode-scanner__scan_region img {
              display: none !important;
            }
          `}</style>
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white">
            <div className="text-sm">Scanner un code-barres</div>
            <button
              onClick={() => setIsScannerOpen(false)}
              className="h-9 w-9 rounded-full border border-white/40 text-lg leading-none"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div id="promo-barcode-scanner" className="w-full h-full" />
          </div>
          {mobileLoading && (
            <div className="absolute bottom-6 left-4 right-4 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-900">
              Récupération des infos produit...
            </div>
          )}
          {scanMessage && (
            <div className="absolute bottom-6 left-4 right-4 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs text-white">
              {scanMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Promos;
