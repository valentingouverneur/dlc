export interface Product {
  id?: string;
  name: string;
  brand: string;
  barcode: string;
  expiryDate: Date;
  imageUrl?: string;
  createdAt: Date;
  // Informations nutritionnelles
  nutrition?: {
    calories?: number;
    proteins?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    salt?: number;
  };
  // Informations supplémentaires
  quantity?: string;
  categories?: string[];
  ingredients?: string[];
  allergens?: string[];
  labels?: string[];
  ecoScore?: 'A' | 'B' | 'C' | 'D' | 'E';
  novaGroup?: 1 | 2 | 3 | 4;
  nutriscore?: 'A' | 'B' | 'C' | 'D' | 'E';
  // Informations de traçabilité
  origins?: string[];
  manufacturingPlaces?: string[];
  packaging?: string[];
  // Informations de conservation
  storageConditions?: string;
  // Informations de consommation
  servingSize?: string;
  preparationInstructions?: string;
} 