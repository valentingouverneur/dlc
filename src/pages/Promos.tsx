import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
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

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const fetchOpenFoodData = useCallback(async (barcode: string) => {
    try {
      const response = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.data.status === 1 && response.data.product) {
        const product = response.data.product;
        const designation = product.product_name_fr || product.product_name || product.generic_name || '';
        const googleImage = await ImageSearchService.searchImage(barcode, designation);
        return {
          designation,
          imageUrl: googleImage || ''
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

  const handleEanLookup = useCallback(
    async (id: string, ean: string) => {
      if (!/^\d{13}$/.test(ean)) {
        return;
      }
      const data = await fetchOpenFoodData(ean);
      if (!data) {
        return;
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, designation: data.designation || item.designation, imageUrl: data.imageUrl || item.imageUrl }
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
    setMobileLoading(true);
    const data = await fetchOpenFoodData(decodedText);
    setMobileItem((prev) => ({
      ...prev,
      ean: decodedText,
      designation: data?.designation || prev.designation,
      imageUrl: data?.imageUrl || prev.imageUrl
    }));
    setMobileLoading(false);
    setMobileStep('form');
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
  }, [fetchOpenFoodData]);

  useEffect(() => {
    if (!isMobile || mobileStep !== 'scan') return;
    const config = {
      fps: 10,
      qrbox: { width: 240, height: 240 },
      aspectRatio: 1.0
    };
    scannerRef.current = new Html5QrcodeScanner('promo-barcode-scanner', config, false);
    scannerRef.current.render(handleMobileScan, () => undefined);
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [handleMobileScan, isMobile, mobileStep]);

  const addMobileItem = (keepScanning: boolean) => {
    setItems((prev) => [...prev, { ...mobileItem, id: crypto.randomUUID() }]);
    setMobileItem(createEmptyItem());
    setMobileStep(keepScanning ? 'scan' : 'form');
  };

  const handleStockBlur = (index: number, value: string) => {
    if (!value.trim()) return;
    if (index === items.length - 1) {
      addRow();
    }
  };

  const handleSaveCatalog = async () => {
    if (!catalogName.trim()) {
      setCatalogSaveMessage('Nom de catalogue obligatoire.');
      return;
    }
    setCatalogSaving(true);
    setCatalogSaveMessage('');
    try {
      await addDoc(collection(db, 'promoCatalogs'), {
        name: catalogName.trim(),
        startDate: catalogStart,
        endDate: catalogEnd,
        items,
        promoGroups,
        createdAt: new Date().toISOString()
      });
      setCatalogSaveMessage('Catalogue enregistré.');
    } catch (error) {
      console.error('Erreur enregistrement catalogue:', error);
      setCatalogSaveMessage('Erreur lors de l’enregistrement.');
    } finally {
      setCatalogSaving(false);
    }
  };

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
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Importer un fichier
            </button>
            <button
              onClick={handleSaveCatalog}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
        {catalogSaveMessage && (
          <div className="mt-3 text-sm text-slate-600">{catalogSaveMessage}</div>
        )}
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tableur des articles</h2>
            <p className="text-sm text-slate-500">Saisie EAN → auto-remplissage • promo + prix + stock</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
                <th className="px-4 py-3 text-left font-semibold">Sélection</th>
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
                      onChange={(event) => updateItem(item.id, { ean: event.target.value })}
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
                    onChange={(event) => updateItem(item.id, { ean: event.target.value })}
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
                    ? 'bg-slate-900 text-white'
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
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
        <p className="text-sm text-slate-500">Créer le catalogue, scanner un EAN, saisir prix/stock, enregistrer.</p>

        {mobileStep === 'scan' && (
          <div className="space-y-4">
            <div id="promo-barcode-scanner" className="w-full max-w-md mx-auto" />
            <button
              onClick={() => setMobileStep('form')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              Saisir manuellement
            </button>
          </div>
        )}

        {mobileStep === 'form' && (
          <div className="space-y-3">
            {mobileLoading && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Récupération des infos produit...
              </div>
            )}
            <input
              value={mobileItem.ean}
              onChange={(event) => setMobileItem((prev) => ({ ...prev, ean: event.target.value }))}
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
            <div className="flex gap-2">
              <button
                onClick={() => addMobileItem(false)}
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                Enregistrer
              </button>
              <button
                onClick={() => addMobileItem(true)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                + Scanner un autre
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Promos;
