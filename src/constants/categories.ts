export const PRODUCT_CATEGORIES = [
  'Viande',
  'Poisson',
  'Glaces',
  'Légumes',
  'Pizza',
  'Frites',
  'Plats cuisinés',
  'Entrée',
  'Autre',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Couleurs des badges par catégorie (classes Tailwind) */
export const CATEGORY_BADGE_COLORS: Record<ProductCategory, string> = {
  Viande: 'bg-red-100 text-red-800',
  Poisson: 'bg-blue-100 text-blue-800',
  Glaces: 'bg-cyan-100 text-cyan-800',
  Légumes: 'bg-emerald-100 text-emerald-800',
  Pizza: 'bg-amber-100 text-amber-800',
  Frites: 'bg-yellow-100 text-yellow-800',
  'Plats cuisinés': 'bg-orange-100 text-orange-800',
  Entrée: 'bg-violet-100 text-violet-800',
  Autre: 'bg-slate-100 text-slate-700',
};
