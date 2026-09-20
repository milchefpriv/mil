export type MarketRecipeUnit = "g" | "ml" | "piece";

export type MarketPriceEstimate = {
  unitPriceHt: number;
  observedOn: string;
  sourceLabel: string;
  sourceUrl: string | null;
  confidence: number;
  ruleLabel: string;
};

type MarketRule = {
  label: string;
  unit: MarketRecipeUnit;
  pattern: RegExp;
  displayPriceHt: number;
  confidence: number;
};

export const MARKET_REFERENCE_DATE = "2026-09-20";
export const MARKET_REFERENCE_LABEL = "Barème interne estimatif — calibré sur RNM et tarifs professionnels";

// Prix HT affichables : €/kg pour g, €/L pour ml et €/pièce pour piece.
// Les règles les plus précises doivent rester avant les familles larges.
const MARKET_RULES: MarketRule[] = [
  { label: "Safran", unit: "g", pattern: /^safran$/, displayPriceHt: 5000, confidence: 0.65 },
  { label: "Vanille", unit: "g", pattern: /^vanille$/, displayPriceHt: 800, confidence: 0.55 },
  { label: "Piment d’Espelette", unit: "g", pattern: /piment d espelette/, displayPriceHt: 100, confidence: 0.6 },
  { label: "Épices", unit: "g", pattern: /(cannelle|cumin|epices douces|poivre vert)/, displayPriceHt: 60, confidence: 0.5 },
  { label: "Herbes fraîches", unit: "g", pattern: /(aneth|basilic|cerfeuil|ciboulette|herbes fraiches|menthe|persil|sauge|thym)/, displayPriceHt: 40, confidence: 0.55 },
  { label: "Dessert composé", unit: "g", pattern: /(ganache chocolat|sauce chocolat|tuile cacao|creme pralinee|praline noisette)/, displayPriceHt: 28, confidence: 0.45 },
  { label: "Coulis, glace ou caramel", unit: "g", pattern: /(caramel|coulis|glace vanille|sable breton)/, displayPriceHt: 18, confidence: 0.4 },
  { label: "Filet de bœuf", unit: "g", pattern: /filet de boeuf/, displayPriceHt: 50, confidence: 0.65 },
  { label: "Bœuf premium", unit: "g", pattern: /(steak de boeuf|roti de boeuf)/, displayPriceHt: 34, confidence: 0.6 },
  { label: "Bœuf à mijoter", unit: "g", pattern: /paleron de boeuf/, displayPriceHt: 21, confidence: 0.7 },
  { label: "Tête de veau", unit: "g", pattern: /tete de veau/, displayPriceHt: 18, confidence: 0.55 },
  { label: "Veau", unit: "g", pattern: /veau/, displayPriceHt: 26, confidence: 0.6 },
  { label: "Côte d’agneau", unit: "g", pattern: /cote d agneau/, displayPriceHt: 40, confidence: 0.6 },
  { label: "Agneau", unit: "g", pattern: /agneau/, displayPriceHt: 32, confidence: 0.6 },
  { label: "Charcuterie", unit: "g", pattern: /(lard fume|saucisse|jambon|palette de porc)/, displayPriceHt: 22, confidence: 0.55 },
  { label: "Abats de porc", unit: "g", pattern: /(foie de porc|gorge de porc)/, displayPriceHt: 15, confidence: 0.55 },
  { label: "Porc", unit: "g", pattern: /porc/, displayPriceHt: 18, confidence: 0.55 },
  { label: "Canard", unit: "g", pattern: /canard/, displayPriceHt: 28, confidence: 0.55 },
  { label: "Volaille", unit: "g", pattern: /(poulet|volaille)/, displayPriceHt: 18, confidence: 0.55 },
  { label: "Cabillaud", unit: "g", pattern: /cabillaud/, displayPriceHt: 26, confidence: 0.7 },
  { label: "Saumon", unit: "g", pattern: /saumon/, displayPriceHt: 27, confidence: 0.6 },
  { label: "Truite", unit: "g", pattern: /truite/, displayPriceHt: 22, confidence: 0.6 },
  { label: "Hareng", unit: "g", pattern: /hareng/, displayPriceHt: 20, confidence: 0.55 },
  { label: "Thon", unit: "g", pattern: /\bthon\b/, displayPriceHt: 26, confidence: 0.5 },
  { label: "Brochet", unit: "g", pattern: /brochet/, displayPriceHt: 24, confidence: 0.5 },
  { label: "Poisson fumé", unit: "g", pattern: /poisson fume/, displayPriceHt: 32, confidence: 0.45 },
  { label: "Poisson", unit: "g", pattern: /poisson/, displayPriceHt: 28, confidence: 0.4 },
  { label: "Anchois", unit: "g", pattern: /anchois/, displayPriceHt: 25, confidence: 0.5 },
  { label: "Pistaches", unit: "g", pattern: /pistache/, displayPriceHt: 42, confidence: 0.55 },
  { label: "Beurre", unit: "g", pattern: /beurre/, displayPriceHt: 16, confidence: 0.6 },
  { label: "Fruits secs et graines", unit: "g", pattern: /(amandes|noisette|noix|graines)/, displayPriceHt: 30, confidence: 0.5 },
  { label: "Parmesan ou comté", unit: "g", pattern: /(parmesan|comte)/, displayPriceHt: 34, confidence: 0.55 },
  { label: "Fromage premium", unit: "g", pattern: /(chevre|stracciatella|fromage persille|fromage a pate)/, displayPriceHt: 28, confidence: 0.5 },
  { label: "Fromage", unit: "g", pattern: /(emmental|feta|mozzarella|fromage frais|fromage rape)/, displayPriceHt: 22, confidence: 0.5 },
  { label: "Crèmerie", unit: "g", pattern: /(creme crue|yaourt grec|fromage blanc)/, displayPriceHt: 10, confidence: 0.5 },
  { label: "Fruits rouges", unit: "g", pattern: /(fraises|fruits rouges)/, displayPriceHt: 24, confidence: 0.6 },
  { label: "Fruits de saison", unit: "g", pattern: /(figues|cerises|mirabelles)/, displayPriceHt: 16, confidence: 0.55 },
  { label: "Agrumes confits", unit: "g", pattern: /agrumes confits/, displayPriceHt: 28, confidence: 0.4 },
  { label: "Fruits", unit: "g", pattern: /(pomme verte|pommes|melon|poire)/, displayPriceHt: 8, confidence: 0.5 },
  { label: "Asperges", unit: "g", pattern: /asperges/, displayPriceHt: 18, confidence: 0.6 },
  { label: "Primeurs premium", unit: "g", pattern: /(petits pois|haricots verts)/, displayPriceHt: 15, confidence: 0.65 },
  { label: "Tomates anciennes", unit: "g", pattern: /tomates anciennes/, displayPriceHt: 10, confidence: 0.65 },
  { label: "Concentré de tomate", unit: "g", pattern: /concentre de tomate/, displayPriceHt: 12, confidence: 0.5 },
  { label: "Tomates", unit: "g", pattern: /tomate/, displayPriceHt: 8, confidence: 0.6 },
  { label: "Champignons", unit: "g", pattern: /champignon/, displayPriceHt: 11, confidence: 0.6 },
  { label: "Salades", unit: "g", pattern: /(jeunes pousses|salade)/, displayPriceHt: 18, confidence: 0.5 },
  { label: "Avocat", unit: "g", pattern: /avocat/, displayPriceHt: 12, confidence: 0.5 },
  { label: "Ail", unit: "g", pattern: /^ail$/, displayPriceHt: 16, confidence: 0.65 },
  { label: "Échalote", unit: "g", pattern: /^echalote$/, displayPriceHt: 5, confidence: 0.6 },
  { label: "Légumes courants", unit: "g", pattern: /(carotte|celeri|betterave|oignon|poireau|pomme de terre|potimarron|courge|patate douce)/, displayPriceHt: 6, confidence: 0.55 },
  { label: "Légumes", unit: "g", pattern: /(aubergine|concombre|courgette|epinards|navet|poivron|legumes en brunoise)/, displayPriceHt: 9, confidence: 0.5 },
  { label: "Gingembre", unit: "g", pattern: /gingembre/, displayPriceHt: 10, confidence: 0.55 },
  { label: "Chocolat", unit: "g", pattern: /chocolat/, displayPriceHt: 26, confidence: 0.55 },
  { label: "Miel", unit: "g", pattern: /miel/, displayPriceHt: 16, confidence: 0.5 },
  { label: "Condiments", unit: "g", pattern: /(capres|cornichons|olives|moutarde|pickles|condiment|chutney|rouille|tahini)/, displayPriceHt: 18, confidence: 0.45 },
  { label: "Mayonnaise", unit: "g", pattern: /mayonnaise/, displayPriceHt: 11, confidence: 0.45 },
  { label: "Pâte préparée", unit: "g", pattern: /pate a |pate feuilletee/, displayPriceHt: 15, confidence: 0.4 },
  { label: "Base cuisinée", unit: "g", pattern: /(bechamel|panade)/, displayPriceHt: 11, confidence: 0.35 },
  { label: "Pain", unit: "g", pattern: /(pain|chapelure|croutons)/, displayPriceHt: 9, confidence: 0.5 },
  { label: "Féculents", unit: "g", pattern: /(coquillettes|farine|flocons d avoine|lentilles|pois chiches|quinoa|riz long|riz rond|riz souffle)/, displayPriceHt: 8, confidence: 0.5 },
  { label: "Sucre", unit: "g", pattern: /(sucre|cassonade)/, displayPriceHt: 5, confidence: 0.55 },
  { label: "Gélatine", unit: "g", pattern: /gelatine/, displayPriceHt: 45, confidence: 0.45 },
  { label: "Sel", unit: "g", pattern: /(fleur de sel|sel fin)/, displayPriceHt: 6, confidence: 0.5 },
  { label: "Huile de noix", unit: "ml", pattern: /(huile de noisette|huile de noix)/, displayPriceHt: 28, confidence: 0.55 },
  { label: "Huile d’olive", unit: "ml", pattern: /huile d olive/, displayPriceHt: 16, confidence: 0.6 },
  { label: "Huile neutre", unit: "ml", pattern: /(huile de colza|huile neutre|^huile$)/, displayPriceHt: 7, confidence: 0.55 },
  { label: "Vinaigre premium", unit: "ml", pattern: /(vinaigre balsamique|vinaigre de xeres)/, displayPriceHt: 15, confidence: 0.5 },
  { label: "Vinaigre", unit: "ml", pattern: /vinaigre/, displayPriceHt: 8, confidence: 0.5 },
  { label: "Alcool fort", unit: "ml", pattern: /(cognac|rhum)/, displayPriceHt: 35, confidence: 0.5 },
  { label: "Vin", unit: "ml", pattern: /vin (blanc|rouge)/, displayPriceHt: 10, confidence: 0.5 },
  { label: "Crème", unit: "ml", pattern: /creme/, displayPriceHt: 10, confidence: 0.55 },
  { label: "Lait", unit: "ml", pattern: /lait entier/, displayPriceHt: 2.5, confidence: 0.6 },
  { label: "Fond ou jus", unit: "ml", pattern: /(fond d|jus de boeuf|jus de canard|jus de veau)/, displayPriceHt: 16, confidence: 0.4 },
  { label: "Bouillon", unit: "ml", pattern: /bouillon/, displayPriceHt: 8, confidence: 0.4 },
  { label: "Soupe de poisson", unit: "ml", pattern: /soupe de poisson/, displayPriceHt: 14, confidence: 0.45 },
  { label: "Sauce Nantua", unit: "ml", pattern: /sauce nantua/, displayPriceHt: 22, confidence: 0.4 },
  { label: "Sauce anglaise", unit: "ml", pattern: /sauce anglaise/, displayPriceHt: 13, confidence: 0.4 },
  { label: "Gelée au Madère", unit: "ml", pattern: /gelee au madere/, displayPriceHt: 15, confidence: 0.4 },
  { label: "Vinaigrette", unit: "ml", pattern: /vinaigrette/, displayPriceHt: 10, confidence: 0.4 },
  { label: "Jus de citron", unit: "ml", pattern: /jus de citron/, displayPriceHt: 9, confidence: 0.55 },
  { label: "Sirop", unit: "ml", pattern: /sirop/, displayPriceHt: 7, confidence: 0.4 },
  { label: "Œuf", unit: "piece", pattern: /oeuf/, displayPriceHt: 0.5, confidence: 0.65 },
  { label: "Camembert", unit: "piece", pattern: /camembert/, displayPriceHt: 6, confidence: 0.55 },
  { label: "Citron", unit: "piece", pattern: /citron/, displayPriceHt: 0.9, confidence: 0.6 },
  { label: "Courgette", unit: "piece", pattern: /courgette/, displayPriceHt: 1.7, confidence: 0.5 },
  { label: "Feuille de chou", unit: "piece", pattern: /feuilles de chou/, displayPriceHt: 0.25, confidence: 0.4 },
  { label: "Chou", unit: "piece", pattern: /gros chou/, displayPriceHt: 4.5, confidence: 0.55 },
  { label: "Grosse tomate", unit: "piece", pattern: /grosse tomate/, displayPriceHt: 1.7, confidence: 0.5 },
  { label: "Os à moelle", unit: "piece", pattern: /os a moelle/, displayPriceHt: 4, confidence: 0.45 },
  { label: "Artichaut", unit: "piece", pattern: /artichaut/, displayPriceHt: 2.3, confidence: 0.55 },
  { label: "Poire", unit: "piece", pattern: /poire/, displayPriceHt: 1.2, confidence: 0.5 },
  { label: "Saucisse", unit: "piece", pattern: /saucisse/, displayPriceHt: 4, confidence: 0.5 },
  { label: "Truite", unit: "piece", pattern: /truite/, displayPriceHt: 10, confidence: 0.55 },
  { label: "Bouquet garni", unit: "piece", pattern: /bouquet garni/, displayPriceHt: 1.2, confidence: 0.4 },
];

const GENERIC_MARKET_PRICE: Record<MarketRecipeUnit, number> = { g: 30, ml: 20, piece: 8 };

export function estimateMarketPrice(normalizedName: string, unit: MarketRecipeUnit): MarketPriceEstimate {
  const rule = MARKET_RULES.find((candidate) => candidate.unit === unit && candidate.pattern.test(normalizedName));
  const displayPriceHt = rule?.displayPriceHt ?? GENERIC_MARKET_PRICE[unit];
  return {
    unitPriceHt: unit === "piece" ? displayPriceHt : displayPriceHt / 1000,
    observedOn: MARKET_REFERENCE_DATE,
    sourceLabel: MARKET_REFERENCE_LABEL,
    sourceUrl: null,
    confidence: rule?.confidence ?? 0.2,
    ruleLabel: rule?.label ?? "Famille non reconnue — garde-fou prudent",
  };
}
