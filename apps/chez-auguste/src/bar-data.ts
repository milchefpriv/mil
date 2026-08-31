export const DRINK_CATEGORIES = [
  "Eaux minérales",
  "Softs / sodas",
  "Jus & nectars",
  "Sirops",
  "Bières pression",
  "Bières bouteille / canette",
  "Vins",
  "Cafés / boissons chaudes",
  "Autres sans alcool",
  "Autres alcoolisés",
] as const;

export type DrinkCategory = (typeof DRINK_CATEGORIES)[number];

export type Drink = {
  id: string;
  category: DrinkCategory;
  name: string;
  format: string;
  supplier: string;
  purchasePriceHt: number | null;
  extrasHt: number;
  salePriceTtc: number;
  notes: string;
};

export type DrinkThreshold = {
  vat: number;
  targetRatio: number;
  maximumRatio: number;
};

export type DrinkThresholds = Record<DrinkCategory, DrinkThreshold>;

export const INITIAL_DRINK_THRESHOLDS: DrinkThresholds = {
  "Eaux minérales": { vat: 0.1, targetRatio: 0.28, maximumRatio: 0.33 },
  "Softs / sodas": { vat: 0.1, targetRatio: 0.3, maximumRatio: 0.35 },
  "Jus & nectars": { vat: 0.1, targetRatio: 0.3, maximumRatio: 0.35 },
  Sirops: { vat: 0.1, targetRatio: 0.1, maximumRatio: 0.15 },
  "Bières pression": { vat: 0.2, targetRatio: 0.25, maximumRatio: 0.33 },
  "Bières bouteille / canette": { vat: 0.2, targetRatio: 0.25, maximumRatio: 0.33 },
  Vins: { vat: 0.2, targetRatio: 0.25, maximumRatio: 0.3 },
  "Cafés / boissons chaudes": { vat: 0.1, targetRatio: 0.15, maximumRatio: 0.2 },
  "Autres sans alcool": { vat: 0.1, targetRatio: 0.3, maximumRatio: 0.35 },
  "Autres alcoolisés": { vat: 0.2, targetRatio: 0.25, maximumRatio: 0.33 },
};

export const INITIAL_DRINKS: Drink[] = [
  { id: "water-vittel-50", category: "Eaux minérales", name: "Vittel plate", format: "50 cl", supplier: "", purchasePriceHt: 0.7267, extrasHt: 0, salePriceTtc: 2.9, notes: "" },
  { id: "water-vittel-100", category: "Eaux minérales", name: "Vittel plate", format: "1 L", supplier: "", purchasePriceHt: 0.8217, extrasHt: 0, salePriceTtc: 4.9, notes: "" },
  { id: "water-sparkling-100", category: "Eaux minérales", name: "Eau pétillante", format: "1 L", supplier: "", purchasePriceHt: 0.9177, extrasHt: 0.02, salePriceTtc: 4.9, notes: "" },
  { id: "water-perrier-33", category: "Eaux minérales", name: "Perrier", format: "33 cl", supplier: "", purchasePriceHt: 1.0246, extrasHt: 0.05, salePriceTtc: 3.5, notes: "Paille 0,02 € HT + rondelle de citron 0,03 € HT" },
  { id: "soft-coca", category: "Softs / sodas", name: "Coca-Cola", format: "33 cl", supplier: "", purchasePriceHt: 1.1743, extrasHt: 0.05, salePriceTtc: 3.5, notes: "Paille 0,02 € HT + rondelle de citron 0,03 € HT" },
  { id: "soft-coca-zero", category: "Softs / sodas", name: "Coca-Cola sans sucres", format: "33 cl", supplier: "", purchasePriceHt: 1.0919, extrasHt: 0.05, salePriceTtc: 3.5, notes: "Paille 0,02 € HT + rondelle de citron 0,03 € HT" },
  { id: "soft-orangina", category: "Softs / sodas", name: "Orangina", format: "25 cl", supplier: "", purchasePriceHt: 1.1267, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "soft-limonade", category: "Softs / sodas", name: "Limonade Angeline", format: "25 cl", supplier: "", purchasePriceHt: 0.8225, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "soft-tonic", category: "Softs / sodas", name: "Schweppes Indian Tonic", format: "25 cl", supplier: "", purchasePriceHt: 1.0582, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "soft-ice-tea", category: "Softs / sodas", name: "Ice Tea", format: "25 cl", supplier: "", purchasePriceHt: 0.9027, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "soft-diabolo", category: "Softs / sodas", name: "Diabolo — sirop standard", format: "25 cl", supplier: "", purchasePriceHt: 0.8225, extrasHt: 0.174, salePriceTtc: 3.9, notes: "Sirop 3 cl 0,154 € HT + paille 0,02 € HT ; pêche : +0,041 € HT" },
  { id: "soft-perrier-sirop", category: "Softs / sodas", name: "Perrier sirop — standard", format: "33 cl", supplier: "", purchasePriceHt: 1.0246, extrasHt: 0.174, salePriceTtc: 3.9, notes: "Sirop 3 cl 0,154 € HT + paille 0,02 € HT ; pêche : +0,041 € HT" },
  { id: "juice-orange", category: "Jus & nectars", name: "Pago nectar d’orange", format: "20 cl", supplier: "", purchasePriceHt: 1.2084, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "juice-apple", category: "Jus & nectars", name: "Pago pur jus de pomme", format: "20 cl", supplier: "", purchasePriceHt: 1.1265, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "juice-tomato", category: "Jus & nectars", name: "Pago pur jus de tomate", format: "20 cl", supplier: "", purchasePriceHt: 1.2381, extrasHt: 0.02, salePriceTtc: 3.5, notes: "Paille 0,02 € HT" },
  { id: "syrup-mint", category: "Sirops", name: "Sirop menthe verte", format: "Dose 3 cl", supplier: "", purchasePriceHt: 0.154, extrasHt: 0.02, salePriceTtc: 2.5, notes: "Paille 0,02 € HT" },
  { id: "syrup-grenadine", category: "Sirops", name: "Sirop grenadine", format: "Dose 3 cl", supplier: "", purchasePriceHt: 0.154, extrasHt: 0.02, salePriceTtc: 2.5, notes: "Paille 0,02 € HT" },
  { id: "syrup-lemon", category: "Sirops", name: "Sirop citron jaune", format: "Dose 3 cl", supplier: "", purchasePriceHt: 0.154, extrasHt: 0.02, salePriceTtc: 2.5, notes: "Paille 0,02 € HT" },
  { id: "syrup-peach", category: "Sirops", name: "Sirop pêche", format: "Dose 3 cl", supplier: "", purchasePriceHt: 0.195, extrasHt: 0.02, salePriceTtc: 2.5, notes: "Paille 0,02 € HT" },
  { id: "beer-paillette-25", category: "Bières pression", name: "Paillette blonde", format: "25 cl", supplier: "", purchasePriceHt: 0.72, extrasHt: 0, salePriceTtc: 4, notes: "Coût matière avec 5 % de pertes" },
  { id: "beer-paillette-50", category: "Bières pression", name: "Paillette blonde", format: "50 cl", supplier: "", purchasePriceHt: 1.45, extrasHt: 0, salePriceTtc: 7, notes: "Coût matière avec 5 % de pertes" },
  { id: "beer-white-25", category: "Bières pression", name: "Blanche", format: "25 cl", supplier: "", purchasePriceHt: 1.05, extrasHt: 0, salePriceTtc: 4.5, notes: "Coût matière avec 5 % de pertes" },
  { id: "beer-white-50", category: "Bières pression", name: "Blanche", format: "50 cl", supplier: "", purchasePriceHt: 2.09, extrasHt: 0, salePriceTtc: 7.5, notes: "Coût matière avec 5 % de pertes" },
  { id: "beer-ipa-25", category: "Bières pression", name: "IPA", format: "25 cl", supplier: "", purchasePriceHt: 1.23, extrasHt: 0, salePriceTtc: 5, notes: "Coût matière avec 5 % de pertes" },
  { id: "beer-ipa-50", category: "Bières pression", name: "IPA", format: "50 cl", supplier: "", purchasePriceHt: 2.45, extrasHt: 0, salePriceTtc: 8, notes: "Coût matière avec 5 % de pertes" },
  { id: "wine-red-glass", category: "Vins", name: "Cubi rouge", format: "Verre 12 cl", supplier: "", purchasePriceHt: 0.4301, extrasHt: 0, salePriceTtc: 3.5, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-red-25", category: "Vins", name: "Cubi rouge", format: "Pichet 25 cl", supplier: "", purchasePriceHt: 0.8961, extrasHt: 0, salePriceTtc: 6.5, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-red-50", category: "Vins", name: "Cubi rouge", format: "Pichet 50 cl", supplier: "", purchasePriceHt: 1.7922, extrasHt: 0, salePriceTtc: 11, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-white-glass", category: "Vins", name: "Cubi blanc", format: "Verre 12 cl", supplier: "", purchasePriceHt: 0.4301, extrasHt: 0, salePriceTtc: 3.5, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-white-25", category: "Vins", name: "Cubi blanc", format: "Pichet 25 cl", supplier: "", purchasePriceHt: 0.8961, extrasHt: 0, salePriceTtc: 6.5, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-white-50", category: "Vins", name: "Cubi blanc", format: "Pichet 50 cl", supplier: "", purchasePriceHt: 1.7922, extrasHt: 0, salePriceTtc: 11, notes: "Base : 3,5843 € HT/L" },
  { id: "wine-rhone", category: "Vins", name: "Côtes-du-Rhône AOC La Pinède", format: "75 cl", supplier: "", purchasePriceHt: 4.0214, extrasHt: 0, salePriceTtc: 18, notes: "Vendu uniquement à la bouteille" },
  { id: "wine-ange", category: "Vins", name: "L’Ange blanc IGP", format: "75 cl", supplier: "", purchasePriceHt: 4.4814, extrasHt: 0, salePriceTtc: 18, notes: "Vendu uniquement à la bouteille" },
  { id: "coffee-espresso", category: "Cafés / boissons chaudes", name: "Espresso", format: "1 tasse", supplier: "", purchasePriceHt: 0.1503, extrasHt: 0.0739, salePriceTtc: 2, notes: "Café 7,5 g + sucre + spéculoos" },
  { id: "coffee-long", category: "Cafés / boissons chaudes", name: "Allongé", format: "1 tasse", supplier: "", purchasePriceHt: 0.1503, extrasHt: 0.0739, salePriceTtc: 2, notes: "Café 7,5 g + sucre + spéculoos" },
  { id: "coffee-decaf", category: "Cafés / boissons chaudes", name: "Décaféiné", format: "1 tasse", supplier: "", purchasePriceHt: 0.2321, extrasHt: 0.0739, salePriceTtc: 2, notes: "Renseigner le coût exact" },
  { id: "coffee-noisette", category: "Cafés / boissons chaudes", name: "Noisette", format: "1 tasse", supplier: "", purchasePriceHt: 0.1503, extrasHt: 0.0939, salePriceTtc: 2.1, notes: "Lait avec 20 % de perte" },
  { id: "coffee-cream", category: "Cafés / boissons chaudes", name: "Crème", format: "1 tasse", supplier: "", purchasePriceHt: 0.1503, extrasHt: 0.2339, salePriceTtc: 3.2, notes: "Lait avec 20 % de perte" },
  { id: "coffee-double", category: "Cafés / boissons chaudes", name: "Double espresso", format: "1 tasse", supplier: "", purchasePriceHt: 0.3006, extrasHt: 0.0739, salePriceTtc: 3.9, notes: "15 g de café + sucre + spéculoos" },
  { id: "hot-tea", category: "Cafés / boissons chaudes", name: "Thé", format: "1 sachet", supplier: "", purchasePriceHt: null, extrasHt: 0.0739, salePriceTtc: 3, notes: "À compléter : renseigner le coût exact" },
];
