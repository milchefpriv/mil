import { supabase } from "./shared-state";

export type RecipeIngredientForCosting = {
  name: string;
  quantity: number;
  unit: "g" | "ml" | "pièce" | "piece";
};

export type RecipeIngredientPrice = {
  normalizedAlias: string;
  recipeUnit: "g" | "ml" | "piece";
  referenceUnitPriceHt: number;
  currentUnitPriceHt: number;
  latestInvoiceDate: string | null;
  supplierName: string | null;
  supplierProductLabel: string | null;
  isApproximation: boolean;
};

export type RecipeIngredientCostLine = {
  ingredientName: string;
  quantity: number;
  recipeUnit: "g" | "ml" | "piece" | null;
  hasInvoicePrice: boolean;
  currentUnitPriceHt: number | null;
  currentCost: number | null;
  latestInvoiceDate: string | null;
  supplierName: string | null;
  supplierProductLabel: string | null;
  isApproximation: boolean;
};

export type RecipeCostBreakdown = {
  liveCost: number;
  rawLiveCost: number;
  manualBaseCost: number;
  knownCurrentCost: number;
  knownReferenceCost: number;
  estimatedRemainder: number;
  matchedIngredientCount: number;
  ingredientCount: number;
  latestInvoiceDate: string | null;
  lines: RecipeIngredientCostLine[];
};

type DbRow = Record<string, unknown>;

const RECIPE_PRICE_VIEW = "auguste_recipe_ingredient_prices";
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

function parsePriceRow(row: DbRow): RecipeIngredientPrice | null {
  const normalizedAlias = normalizeRecipeIngredientName(readString(row, ["normalized_alias", "ingredient_alias", "alias"]));
  const recipeUnit = normalizeRecipeUnit(readString(row, ["ingredient_unit", "recipe_unit", "unit"]));
  const referenceUnitPriceHt = readNumber(row, ["reference_unit_price_ht", "frozen_reference_unit_price_ht"]);
  const currentUnitPriceHt = readNumber(row, ["current_unit_price_ht", "latest_unit_price_ht"]);
  if (!normalizedAlias || !recipeUnit || referenceUnitPriceHt === null || currentUnitPriceHt === null) return null;
  if (referenceUnitPriceHt < 0 || currentUnitPriceHt < 0) return null;

  const latestInvoiceDate = readString(row, ["latest_invoice_date", "invoice_date", "price_date"]);
  return {
    normalizedAlias,
    recipeUnit,
    referenceUnitPriceHt,
    currentUnitPriceHt,
    latestInvoiceDate: latestInvoiceDate || null,
    supplierName: readString(row, ["supplier_name"]) || null,
    supplierProductLabel: readString(row, ["supplier_product_label"]) || null,
    isApproximation: row.is_approximation === true,
  };
}

export async function loadRecipeIngredientPrices(): Promise<RecipeIngredientPrice[]> {
  const { data, error } = await supabase
    .from(RECIPE_PRICE_VIEW)
    .select("normalized_alias,ingredient_unit,reference_unit_price_ht,latest_unit_price_ht,latest_invoice_date,supplier_name,supplier_product_label,is_approximation")
    .eq("workspace_id", WORKSPACE_ID);
  if (error) throw error;
  return ((data ?? []) as unknown as DbRow[]).map(parsePriceRow).filter((row): row is RecipeIngredientPrice => Boolean(row));
}

export function calculateRecipeCost(
  manualBaseCost: number,
  currentIngredients: RecipeIngredientForCosting[],
  referenceIngredients: RecipeIngredientForCosting[],
  prices: RecipeIngredientPrice[],
): RecipeCostBreakdown {
  const safeBaseCost = Number.isFinite(manualBaseCost) && manualBaseCost >= 0 ? manualBaseCost : 0;
  const pricesByIngredient = new Map<string, RecipeIngredientPrice>();
  prices.forEach((price) => {
    const key = priceKey(price.normalizedAlias, price.recipeUnit);
    if (key) pricesByIngredient.set(key, price);
  });

  let knownCurrentCost = 0;
  let knownReferenceCost = 0;
  let matchedIngredientCount = 0;
  let latestInvoiceDate: string | null = null;

  const lines = currentIngredients.map((ingredient): RecipeIngredientCostLine => {
    const recipeUnit = normalizeRecipeUnit(ingredient.unit);
    const key = priceKey(ingredient.name, ingredient.unit);
    const price = key ? pricesByIngredient.get(key) : undefined;
    const hasValidQuantity = Number.isFinite(ingredient.quantity) && ingredient.quantity > 0;
    if (!price || !hasValidQuantity) {
      return {
        ingredientName: ingredient.name,
        quantity: Number.isFinite(ingredient.quantity) ? Math.max(ingredient.quantity, 0) : 0,
        recipeUnit,
        hasInvoicePrice: Boolean(price),
        currentUnitPriceHt: price?.currentUnitPriceHt ?? null,
        currentCost: price ? 0 : null,
        latestInvoiceDate: price?.latestInvoiceDate ?? null,
        supplierName: price?.supplierName ?? null,
        supplierProductLabel: price?.supplierProductLabel ?? null,
        isApproximation: price?.isApproximation ?? false,
      };
    }

    const currentCost = ingredient.quantity * price.currentUnitPriceHt;
    knownCurrentCost += currentCost;
    matchedIngredientCount += 1;
    if (price.latestInvoiceDate && (!latestInvoiceDate || price.latestInvoiceDate > latestInvoiceDate)) {
      latestInvoiceDate = price.latestInvoiceDate;
    }
    return {
      ingredientName: ingredient.name,
      quantity: ingredient.quantity,
      recipeUnit,
      hasInvoicePrice: true,
      currentUnitPriceHt: price.currentUnitPriceHt,
      currentCost,
      latestInvoiceDate: price.latestInvoiceDate,
      supplierName: price.supplierName,
      supplierProductLabel: price.supplierProductLabel,
      isApproximation: price.isApproximation,
    };
  });

  referenceIngredients.forEach((ingredient) => {
    if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) return;
    const key = priceKey(ingredient.name, ingredient.unit);
    const price = key ? pricesByIngredient.get(key) : undefined;
    if (price) knownReferenceCost += ingredient.quantity * price.referenceUnitPriceHt;
  });

  const estimatedRemainder = Math.max(safeBaseCost - knownReferenceCost, 0);
  const rawLiveCost = knownCurrentCost + estimatedRemainder;
  return {
    liveCost: roundCost(rawLiveCost),
    rawLiveCost,
    manualBaseCost: safeBaseCost,
    knownCurrentCost,
    knownReferenceCost,
    estimatedRemainder,
    matchedIngredientCount,
    ingredientCount: currentIngredients.filter((ingredient) => Number.isFinite(ingredient.quantity) && ingredient.quantity > 0).length,
    latestInvoiceDate,
    lines,
  };
}

export function manualBaseCostForTarget(targetLiveCost: number, breakdown: RecipeCostBreakdown): number {
  const safeTarget = Number.isFinite(targetLiveCost) && targetLiveCost >= 0 ? targetLiveCost : 0;
  return roundCost(
    breakdown.knownReferenceCost + Math.max(safeTarget - breakdown.knownCurrentCost, 0),
  );
}
