import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../config/firebase';

type PromoItem = {
  ean?: string;
  designation?: string;
  promoType?: string;
  priceSell?: string;
  stock?: string;
  imageUrl?: string;
};

type PromoGroup = {
  name: string;
  tg: string;
  items?: PromoItem[];
};

type PromoCatalog = {
  id: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  items?: PromoItem[];
  promoGroups?: PromoGroup[];
};

const PromosCalendar: React.FC = () => {
  const [catalogs, setCatalogs] = useState<PromoCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'promoCatalogs'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as PromoCatalog[];
        setCatalogs(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, []);

  const timelineItems = useMemo(() => catalogs.slice(0, 12), [catalogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <header className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Calendrier des promos</h1>
            <p className="text-sm text-slate-500">Timeline des catalogues + liste des produits.</p>
          </div>
          <Link
            to="/promos/manage"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Gestion des catalogues
          </Link>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
            <p className="text-sm text-slate-500">Catalogues en cours et à venir.</p>
          </div>
        </div>
        {timelineItems.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Aucun catalogue enregistré.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="flex gap-3 min-w-[600px]">
              {timelineItems.map((catalog) => (
                <div
                  key={catalog.id}
                  className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {catalog.name || 'Catalogue'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {catalog.startDate || '—'} → {catalog.endDate || '—'}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    {(catalog.items?.length || 0)} article(s)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        {catalogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
            Aucun catalogue disponible pour l’instant.
          </div>
        ) : (
          catalogs.map((catalog) => (
            <div key={catalog.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{catalog.name || 'Catalogue'}</h3>
                  <p className="text-sm text-slate-500">
                    {catalog.startDate || '—'} → {catalog.endDate || '—'}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {(catalog.items?.length || 0)} article(s) • {(catalog.promoGroups?.length || 0)} promo(s)
                </div>
              </div>

              {catalog.promoGroups && catalog.promoGroups.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {catalog.promoGroups.map((group) => (
                    <div key={`${catalog.id}-${group.name}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-slate-900">{group.name}</div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                          {group.tg}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {(group.items?.length || 0)} article(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">EAN</th>
                      <th className="px-3 py-2 text-left font-semibold">Produit</th>
                      <th className="px-3 py-2 text-left font-semibold">Type promo</th>
                      <th className="px-3 py-2 text-left font-semibold">PVH</th>
                      <th className="px-3 py-2 text-left font-semibold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(catalog.items || []).map((item, index) => (
                      <tr key={`${catalog.id}-item-${index}`}>
                        <td className="px-3 py-2 text-xs text-slate-700">{item.ean || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="h-8 w-8 rounded border object-contain" />
                            ) : (
                              <div className="h-8 w-8 rounded border border-dashed border-slate-200 bg-slate-50" />
                            )}
                            <span className="text-xs text-slate-700">{item.designation || '—'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{item.promoType || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{item.priceSell || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{item.stock || '—'}</td>
                      </tr>
                    ))}
                    {(!catalog.items || catalog.items.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-xs text-slate-500">
                          Aucun article enregistré dans ce catalogue.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default PromosCalendar;
