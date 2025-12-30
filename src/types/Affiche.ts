export interface Affiche {
  id?: string;
  ean: string;
  designation: string;
  brand?: string;
  weight?: string;       // ex: "500g", "1kg"
  price?: string;        // ex: "29,99 €"
  pricePerKg?: string;   // ex: "59,98 €/kg"
  createdAt: string;     // ISO string
}

