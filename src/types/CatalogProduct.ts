import type { ProductCategory } from '../constants/categories';

export interface CatalogProduct {
  ean: string;
  title: string;
  brand?: string;
  weight?: string;
  category?: ProductCategory;
  imageUrl?: string;
  source?: 'abaco' | 'off' | 'manual';
  lastUpdated?: string;
}
