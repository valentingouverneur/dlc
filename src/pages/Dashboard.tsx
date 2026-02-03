import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Données chiffre d'affaire hebdo
const kpiData = {
  ca: { current: 41009, previous: 31814, trend: 29 },
  freq: { current: 4780, previous: 3929, trend: 21.7 },
  uvc: { current: 11029, previous: 8295, trend: 33 },
  panier: { current: 8.58, previous: 8.1 },
};

// Répartition par secteur (pour DonutChart: index = libellé, category = valeur)
const secteurData = [
  { secteur: 'Viande', ca: 9624 },
  { secteur: 'Poisson', ca: 8587 },
  { secteur: 'Glaces', ca: 3938 },
  { secteur: 'Légumes', ca: 3587 },
  { secteur: 'Pizza', ca: 3665 },
  { secteur: 'Frites', ca: 4754 },
  { secteur: 'Plats cuisinés', ca: 2665 },
  { secteur: 'Entrée', ca: 1585 },
];

// Une couleur hex par catégorie (même ordre que secteurData) pour le camembert et la légende
const secteurCouleursHex = [
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#f97316', // orange
  '#14b8a6', // teal
];

// Petite répartition 70 / 30 (ex : Promo / Hors promo)
const repartition7030 = [
  { label: 'Promo', value: 70 },
  { label: 'Hors promo', value: 30 },
];

// Top 10 promo (à remplacer par import top_10_ventes_promos.xlsx)
const top10Promo = [
  { rank: 1, designation: 'Produit promo 1', ventes: '—' },
  { rank: 2, designation: 'Produit promo 2', ventes: '—' },
  { rank: 3, designation: 'Produit promo 3', ventes: '—' },
  { rank: 4, designation: 'Produit promo 4', ventes: '—' },
  { rank: 5, designation: 'Produit promo 5', ventes: '—' },
  { rank: 6, designation: 'Produit promo 6', ventes: '—' },
  { rank: 7, designation: 'Produit promo 7', ventes: '—' },
  { rank: 8, designation: 'Produit promo 8', ventes: '—' },
  { rank: 9, designation: 'Produit promo 9', ventes: '—' },
  { rank: 10, designation: 'Produit promo 10', ventes: '—' },
];

// Top 10 rayon (données type Abaco - désignation + CA TTC, triés par CA TTC desc)
const top10Rayon = [
  { rank: 1, designation: 'FILET FACON FISH/CHIPS X4 400G', caTtc: 1828.18 },
  { rank: 2, designation: 'SH SURG X10 15%MG 100%M VBF', caTtc: 1450.22 },
  { rank: 3, designation: 'ST HACHE SURGELE X10 20% MG EC', caTtc: 1179.9 },
  { rank: 4, designation: 'HACHE MOELLEUX BF VBF 20X80G', caTtc: 423.54 },
  { rank: 5, designation: 'HACHE SUPERTENDRE SURG X10 VBF', caTtc: 395.85 },
  { rank: 6, designation: 'BEIGNET DE CALAMAR 500G', caTtc: 378.46 },
  { rank: 7, designation: 'HAMBURGER SURG X10 15% MG ECO+', caTtc: 352.62 },
  { rank: 8, designation: '8 CORDONS BLEUS DE DINDE 800G', caTtc: 325.18 },
  { rank: 9, designation: '10 STEACK HACHE PUR BOEUF 1KG', caTtc: 323.4 },
  { rank: 10, designation: 'Autre produit rayon (à importer Abaco)', caTtc: 337.84 },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

const Dashboard: React.FC = () => {
  const panierDiff = ((kpiData.panier.current - kpiData.panier.previous) / kpiData.panier.previous) * 100;

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Chiffre d'affaire hebdo et répartition par secteur
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtre
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Chiffre d'affaire hebdo</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatNumber(kpiData.ca.current)} €
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <span>↑ {kpiData.ca.trend}%</span>
            <span className="text-slate-400">vs {formatNumber(kpiData.ca.previous)} €</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Freq</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatNumber(kpiData.freq.current)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <span>↑ {kpiData.freq.trend}%</span>
            <span className="text-slate-400">vs {formatNumber(kpiData.freq.previous)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">UVC</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatNumber(kpiData.uvc.current)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <span>↑ {kpiData.uvc.trend}%</span>
            <span className="text-slate-400">vs {formatNumber(kpiData.uvc.previous)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Panier moyen</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {kpiData.panier.current.toFixed(2)} €
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs">
            {panierDiff >= 0 ? (
              <span className="text-emerald-600">↑ {panierDiff.toFixed(1)}%</span>
            ) : (
              <span className="text-rose-500">↓ {Math.abs(panierDiff).toFixed(1)}%</span>
            )}
            <span className="text-slate-400">vs {kpiData.panier.previous.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* Répartition par secteur */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Répartition chiffres par secteur</h2>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Filtre
          </button>
        </div>
        <div className="mt-4 flex flex-col items-center">
          <div className="h-80 w-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={secteurData}
                  dataKey="ca"
                  nameKey="secteur"
                  cx="50%"
                  cy="50%"
                  outerRadius="100%"
                  innerRadius={0}
                  paddingAngle={1}
                  stroke="white"
                  strokeWidth={1}
                  isAnimationActive
                  animationDuration={800}
                  label={false}
                >
                  {secteurData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={secteurCouleursHex[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  labelFormatter={(label) => label}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4" role="list" aria-label="Légende secteurs">
            {secteurData.map((row, i) => (
              <div key={row.secteur} className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: secteurCouleursHex[i] }}
                  aria-hidden
                />
                <span className="text-slate-700">{row.secteur}</span>
                <span className="ml-auto font-medium text-slate-900">{formatNumber(row.ca)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ligne test : card vide + camembert 70/30 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Card vide */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-medium text-slate-700">Bloc vide (placeholder)</div>
          <div className="mt-4 h-40 rounded-xl border border-dashed border-slate-200 bg-slate-50" />
        </div>

        {/* Camembert 70 / 30 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Répartition 70 / 30</h2>
            <span className="text-xs text-slate-500">Exemple visuel</span>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <div className="h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={repartition7030}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius="100%"
                    innerRadius={0}
                    paddingAngle={2}
                    stroke="white"
                    strokeWidth={1}
                    isAnimationActive
                    animationDuration={700}
                    label={false}
                  >
                    <Cell fill="#6366f1" /> {/* 70% */}
                    <Cell fill="#e5e7eb" /> {/* 30% */}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value}%`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    labelFormatter={(label) => label}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-indigo-500" />
                <span className="text-slate-700">Promo</span>
                <span className="ml-1 font-medium text-slate-900">70%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-300" />
                <span className="text-slate-700">Hors promo</span>
                <span className="ml-1 font-medium text-slate-900">30%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 promo + Top 10 rayon */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Top 10 promo</h2>
            <span className="text-xs text-slate-500">top_10_ventes_promos.xlsx</span>
          </div>
          <div className="mt-4 space-y-2">
            {top10Promo.map((row) => (
              <div
                key={row.rank}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 text-xs font-medium text-slate-700">
                    {row.rank}
                  </span>
                  <span className="truncate text-slate-800">{row.designation}</span>
                </div>
                <span className="shrink-0 text-slate-500">{row.ventes}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Top 10 rayon complet</h2>
            <span className="text-xs text-slate-500">Abaco</span>
          </div>
          <div className="mt-4 space-y-2">
            {top10Rayon.map((row) => (
              <div
                key={`${row.rank}-${row.designation}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-200 text-xs font-medium text-slate-700">
                    {row.rank}
                  </span>
                  <span className="truncate text-slate-800">{row.designation}</span>
                </div>
                <span className="shrink-0 font-medium text-slate-700">{row.caTtc.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
