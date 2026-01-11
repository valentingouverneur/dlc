export interface Promo {
  id?: string;
  ean: string;
  designation: string;
  fournisseur?: string;
  refFabricant?: string;
  lec?: string;
  activite?: string; // ex: "DRV, HYP, SUP"
  classification?: string;
  
  // Promotion
  promoType?: string; // ex: "-68% REDUCTION IMMEDIATE", "La 3ème OFFERT", "Le 2ème -1.23"
  promoIcon?: string; // Type d'icône (rouge, bleu, jaune)
  promoValue?: string; // Valeur de la promo (ex: "68%", "3", "1.23")
  
  // Prospectus
  prospectus?: string; // ex: "26G302G EVENEMENT 2"
  dateDebut?: string; // Format: "YYYY-MM-DD"
  dateFin?: string; // Format: "YYYY-MM-DD"
  
  // Prix
  pvpHPub?: number;
  p3nHT?: number;
  p3nActuel?: number;
  dateP3N?: string;
  srpTTC?: number;
  pvh?: number;
  pvhPromo?: number;
  
  // Historique
  promoN1?: string; // Promotion de l'année précédente
  venteN1?: number;
  totalCdeN1?: number;
  stockCpal?: number;
  
  // Commande actuelle
  commande?: number;
  cde?: number;
  box?: number;
  liv?: string; // Date de livraison
  qteUVC?: number;
  uvC?: number;
  
  // Image
  imageUrl?: string;
  
  // Métadonnées
  createdAt?: string;
  updatedAt?: string;
}
