import { estimateMarketPrice } from "./market-pricing";
import { supabase } from "./shared-state";

export type RecipeIngredientForCosting = {
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pièce" | "piece";
};

export type RecipePriceOrigin = "invoice" | "market";
export type MarketConfidence = "high" | "medium" | "low";

export type RecipeIngredientPrice = {
  normalizedAlias: string;
  recipeUnit: "g" | "ml" | "piece";
  priceOrigin: RecipePriceOrigin;
  referenceUnitPriceHt: number;
  currentUnitPriceHt: number;
  priceDate: string | null;
  latestInvoiceDate: string | null;
  supplierName: string | null;
  supplierProductLabel: string | null;
  isApproximation: boolean;
  marketSourceLabel: string | null;
  marketSourceUrl: string | null;
  marketConfidenceValue: number | null;
  marketRuleLabel: string | null;
};

export type RecipeIngredientCostLine = {
  ingredientName: string;
  quantity: number;
  recipeUnit: "g" | "ml" | "piece" | null;
  priceOrigin: RecipePriceOrigin | "missing";
  hasInvoicePrice: boolean;
  hasMarketEstimate: boolean;
  currentUnitPriceHt: number | null;
  currentCost: number | null;
  priceDate: string | null;
  latestInvoiceDate: string | null;
  supplierName: string | null;
  supplierProductLabel: string | null;
  isApproximation: boolean;
  marketSourceLabel: string | null;
  marketSourceUrl: string | null;
  marketConfidence: MarketConfidence | null;
  marketRuleLabel: string | null;
};

export type RecipeCostBreakdown = {
  liveCost: number;
  rawLiveCost: number;
  manualBaseCost: number;
  invoiceCurrentCost: number;
  marketEstimatedCost: number;
  knownCurrentCost: number;
  knownReferenceCost: number;
  manualAdjustment: number;
  estimatedRemainder: number;
  invoiceIngredientCount: number;
  marketIngredientCount: number;
  pricedIngredientCount: number;
  matchedIngredientCount: number;
  ingredientCount: number;
  latestInvoiceDate: string | null;
  latestMarketDate: string | null;
  lines: RecipeIngredientCostLine[];
};

export type RecipeCostingOptions = {
  preserveManualAdjustment?: boolean;
};

type DbRow = Record<string, unknown>;

const RECIPE_COST_VIEW = "auguste_recipe_ingredient_costs";
const LEGACY_RECIPE_PRICE_VIEW = "auguste_recipe_ingredient_prices";
const WORKSPACE_ID = "a617e000-0000-4000-8000-000000000001";

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(row: DbRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readNumber(row: DbRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = finiteNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

export function normalizeRecipeIngredientName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr")
    .replaceAll("œ", "oe")
    .replaceAll("æ", "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRecipeUnit(value: RecipeIngredientForCosting["unit"] | string): "g" | "ml" | "piece" | null {
  const normalized = normalizeRecipeIngredientName(value);
  if (normalized === "g" || normalized === "gramme" || normalized === "grammes") return "g";
  if (normalized === "ml" || normalized === "millilitre" || normalized === "millilitres") return "ml";
  if (normalized === "piece" || normalized === "pieces") return "piece";
  return null;
}

function priceKey(name: string, unit: string): string | null {
  const normalizedName = normalizeRecipeIngredientName(name);
  const normalizedUnit = normalizeRecipeUnit(unit);
  return normalizedName && normalizedUnit ? `${normalizedName}\u0000${normalizedUnit}` : null;
}

function roundCost(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function confidenceBand(value: number | null): MarketConfidence | null {
  if (value === null) return null;
  if (value >= 0.7) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

function parsePriceRow(row: DbRow): RecipeIngredientPrice | null {
  const normalizedAlias = normalizeRecipeIngredientName(readString(row, ["normalized_alias", "ingredient_alias", "alias"]));
  const recipeUnit = normalizeRecipeUnit(readString(row, ["ingredient_unit", "recipe_unit", "unit"]));
  const currentUnitPriceHt = readNumber(row, ["effective_unit_price_ht", "current_unit_price_ht", "latest_unit_price_ht"]);
  const referenceUnitPriceHt = readNumber(row, ["reference_unit_price_ht", "frozen_reference_unit_price_ht"]) ?? currentUnitPriceHt;
  if (!normalizedAlias || !recipeUnit || referenceUnitPriceHt === null || currentUnitPriceHt === null) return null;
  if (referenceUnitPriceHt < 0 || currentUnitPriceHt < 0) return null;

  const source = readString(row, ["price_source"]);
  const priceOrigin: RecipePriceOrigin = source === "market" || source === "market_estimate" ? "market" : "invoice";
  const latestInvoiceDate = readString(row, ["latest_invoice_date", "invoice_date"]);
  const priceDate = readString(row, ["effective_price_date", "market_observed_on", "latest_invoice_date", "invoice_date", "price_date"]);
  const marketMethod = readString(row, ["market_estimation_method", "market_rule_label"]);
  return {
    normalizedAlias,
    recipeUnit,
    priceOrigin,
    referenceUnitPriceHt,
    currentUnitPriceHt,
    priceDate: priceDate || null,
    latestInvoiceDate: latestInvoiceDate || null,
    supplierName: readString(row, ["supplier_name"]) || null,
    supplierProductLabel: readString(row, ["supplier_product_label"]) || null,
    isApproximation: row.is_approximation === true,
    marketSourceLabel: readString(row, ["market_source_label"]) || null,
    marketSourceUrl: readString(row, ["market_source_url", "source_url"]) || null,
    marketConfidenceValue: readNumber(row, ["market_confidence", "confidence"]),
    marketRuleLabel: marketMethod === "recomposed_cost"
      ? "Coût de préparation recomposé"
      : marketMethod === "market_benchmark"
        ? "Repère de marché"
        : marketMethod || null,
  };
}

async function loadFromView(view: string, columns: string): Promise<{ data: RecipeIngredientPrice[]; error: unknown }> {
  const { data, error } = await supabase.from(view).select(columns).eq("workspace_id", WORKSPACE_ID);
  return {
    data: ((data ?? []) as unknown as DbRow[]).map(parsePriceRow).filter((row): row is RecipeIngredientPrice => Boolean(row)),
    error,
  };
}

export async function loadRecipeIngredientPrices(): Promise<RecipeIngredientPrice[]> {
  const [current, legacy] = await Promise.all([
    loadFromView(
      RECIPE_COST_VIEW,
      "normalized_alias,ingredient_unit,reference_unit_price_ht,effective_unit_price_ht,price_source,effective_price_date,latest_invoice_date,supplier_name,supplier_product_label,is_approximation,market_source_label,market_source_url,market_observed_on,market_confidence,market_estimation_method",
    ),
    loadFromView(
      LEGACY_RECIPE_PRICE_VIEW,
      "normalized_alias,ingredient_unit,reference_unit_price_ht,latest_unit_price_ht,latest_invoice_date,supplier_name,supplier_product_label,is_approximation",
    ),
  ]);
  if (current.error && legacy.error) throw current.error;

  const merged = new Map<string, RecipeIngredientPrice>();
  [...current.data, ...legacy.data].forEach((price) => {
    const key = priceKey(price.normalizedAlias, price.recipeUnit);
    if (key) merged.set(key, choosePrice(merged.get(key), price));
  });
  if (!merged.size) console.warn("Aucun prix fournisseur ou marché n’a été chargé ; le barème estimatif local est utilisé.");
  return [...merged.values()];
}

function fallbackMarketPrice(name: string, unit: "g" | "ml" | "piece"): RecipeIngredientPrice {
  const normalizedAlias = normalizeRecipeIngredientName(name);
  const estimate = estimateMarketPrice(normalizedAlias, unit);
  return {
    normalizedAlias,
    recipeUnit: unit,
    priceOrigin: "market",
    referenceUnitPriceHt: estimate.unitPriceHt,
    currentUnitPriceHt: estimate.unitPriceHt,
    priceDate: estimate.observedOn,
    latestInvoiceDate: null,
    supplierName: null,
    supplierProductLabel: null,
    isApproximation: true,
    marketSourceLabel: estimate.sourceLabel,
    marketSourceUrl: estimate.sourceUrl,
    marketConfidenceValue: estimate.confidence,
    marketRuleLabel: estimate.ruleLabel,
  };
}

function choosePrice(existing: RecipeIngredientPrice | undefined, candidate: RecipeIngredientPrice): RecipeIngredientPrice {
  if (!existing || (candidate.priceOrigin === "invoice" && existing.priceOrigin !== "invoice")) return candidate;
  if (candidate.priceOrigin === existing.priceOrigin && (candidate.priceDate ?? "") > (existing.priceDate ?? "")) return candidate;
  return existing;
}

export function calculateRecipeCost(
  manualBaseCost: number,
  currentIngredients: RecipeIngredientForCosting[],
  referenceIngredients: RecipeIngredientForCosting[],
  prices: RecipeIngredientPrice[],
  options: RecipeCostingOptions = {},
): RecipeCostBreakdown {
  const safeBaseCost = Number.isFinite(manualBaseCost) && manualBaseCost >= 0 ? manualBaseCost : 0;
  const pricesByIngredient = new Map<string, RecipeIngredientPrice>();
  prices.forEach((price) => {
    const key = priceKey(price.normalizedAlias, price.recipeUnit);
    if (key) pricesByIngredient.set(key, choosePrice(pricesByIngredient.get(key), price));
  });

  function resolvePrice(ingredient: RecipeIngredientForCosting): RecipeIngredientPrice | null {
    const recipeUnit = normalizeRecipeUnit(ingredient.unit);
    const key = priceKey(ingredient.name, ingredient.unit);
    if (!recipeUnit || !key) return null;
    return pricesByIngredient.get(key) ?? fallbackMarketPrice(ingredient.name, recipeUnit);
  }

  let invoiceCurrentCost = 0;
  let marketEstimatedCost = 0;
  let invoiceIngredientCount = 0;
  let marketIngredientCount = 0;
  let latestInvoiceDate: string | null = null;
  let latestMarketDate: string | null = null;

  const lines = currentIngredients.map((ingredient): RecipeIngredientCostLine => {
    const recipeUnit = normalizeRecipeUnit(ingredient.unit);
    const price = resolvePrice(ingredient);
    const hasValidQuantity = Number.isFinite(ingredient.quantity) && ingredient.quantity > 0;
    if (!price || !hasValidQuantity) {
      return {
        ingredientName: ingredient.name,
        quantity: Number.isFinite(ingredient.quantity) ? Math.max(ingredient.quantity, 0) : 0,
        recipeUnit,
        priceOrigin: price?.priceOrigin ?? "missing",
        hasInvoicePrice: price?.priceOrigin === "invoice",
        hasMarketEstimate: price?.priceOrigin === "market",
        currentUnitPriceHt: price?.currentUnitPriceHt ?? null,
        currentCost: price ? 0 : null,
        priceDate: price?.priceDate ?? null,
        latestInvoiceDate: price?.latestInvoiceDate ?? null,
        supplierName: price?.supplierName ?? null,
        supplierProductLabel: price?.supplierProductLabel ?? null,
        isApproximation: price?.isApproximation ?? false,
        marketSourceLabel: price?.marketSourceLabel ?? null,
        marketSourceUrl: price?.marketSourceUrl ?? null,
        marketConfidence: confidenceBand(price?.marketConfidenceValue ?? null),
        marketRuleLabel: price?.marketRuleLabel ?? null,
      };
    }

    const currentCost = ingredient.quantity * price.currentUnitPriceHt;
    if (price.priceOrigin === "invoice") {
      invoiceCurrentCost += currentCost;
      invoiceIngredientCount += 1;
      if (price.latestInvoiceDate && (!latestInvoiceDate || price.latestInvoiceDate > latestInvoiceDate)) latestInvoiceDate = price.latestInvoiceDate;
    } else {
      marketEstimatedCost += currentCost;
      marketIngredientCount += 1;
      if (price.priceDate && (!latestMarketDate || price.priceDate > latestMarketDate)) latestMarketDate = price.priceDate;
    }

    return {
      ingredientName: ingredient.name,
      quantity: ingredient.quantity,
      recipeUnit,
      priceOrigin: price.priceOrigin,
      hasInvoicePrice: price.priceOrigin === "invoice",
      hasMarketEstimate: price.priceOrigin === "market",
      currentUnitPriceHt: price.currentUnitPriceHt,
      currentCost,
      priceDate: price.priceDate,
      latestInvoiceDate: price.latestInvoiceDate,
      supplierName: price.supplierName,
      supplierProductLabel: price.supplierProductLabel,
      isApproximation: price.isApproximation,
      marketSourceLabel: price.marketSourceLabel,
      marketSourceUrl: price.marketSourceUrl,
      marketConfidence: confidenceBand(price.marketConfidenceValue),
      marketRuleLabel: price.marketRuleLabel,
    };
  });

  let knownReferenceCost = 0;
  referenceIngredients.forEach((ingredient) => {
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) return;
    const price = resolvePrice(ingredient);
    if (price) knownReferenceCost += ingredient.quantity * price.referenceUnitPriceHt;
  });

  const knownCurrentCost = invoiceCurrentCost + marketEstimatedCost;
  const manualAdjustment = options.preserveManualAdjustment ? Math.max(safeBaseCost - knownReferenceCost, 0) : 0;
  const rawLiveCost = knownCurrentCost + manualAdjustment;
  const ingredientCount = currentIngredients.filter((ingredient) => Number.isFinite(ingredient.quantity) && ingredient.quantity > 0).length;
  const pricedIngredientCount = invoiceIngredientCount + marketIngredientCount;

  return {
    liveCost: roundCost(rawLiveCost),
    rawLiveCost,
    manualBaseCost: safeBaseCost,
    invoiceCurrentCost,
    marketEstimatedCost,
    knownCurrentCost,
    knownReferenceCost,
    manualAdjustment,
    estimatedRemainder: manualAdjustment,
    invoiceIngredientCount,
    marketIngredientCount,
    pricedIngredientCount,
    matchedIngredientCount: pricedIngredientCount,
    ingredientCount,
    latestInvoiceDate,
    latestMarketDate,
    lines,
  };
}

export function manualBaseCostForTarget(targetLiveCost: number, breakdown: RecipeCostBreakdown): number {
  const safeTarget = Number.isFinite(targetLiveCost) && targetLiveCost >= 0 ? targetLiveCost : 0;
  return roundCost(breakdown.knownReferenceCost + Math.max(safeTarget - breakdown.knownCurrentCost, 0));
}
