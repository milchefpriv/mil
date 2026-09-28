"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INITIAL_DRINKS, type Drink } from "./bar-data";
import { normalizeRecipeIngredientName, normalizeRecipeUnit } from "./recipe-costing";
import { loadSharedState, supabase } from "./shared-state";
import "./sales-purchases-analytics.css";

type ProductCategory = "food" | "beverage" | "non_food";
type BaseUnit = "g" | "ml" | "piece";
type PeriodOption = "all" | "7" | "30";
type DbRow = Record<string, unknown>;

export type SalesRecipe = {
  id: string;
  name: string;
  course: string;
  costHt: number;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: "g" | "ml" | "pièce" | "piece";
  }>;
  costQuality: string;
  costIsFloor: boolean;
};

export type SalesProductMappings = Record<string, string>;

export type InventoryCounts = Record<string, {
  opening: number | null;
  closing: number | null;
}>;

export type SalesAnalyticsInvoice = {
  id: string;
  supplier: string;
  invoiceNumber: string;
  issueDate: string;
  importedAt: string;
  status: string;
  documentType: string;
};

export type SalesAnalyticsLine = {
  id: string;
  invoiceId: string;
  productId: string;
  description: string;
  supplierReference: string;
  quantity: number | null;
  unit: string;
  totalHt: number | null;
  category: ProductCategory;
  mappingStatus: string;
  normalizedQuantity: number | null;
  normalizedUnit: string;
};

export type SalesAnalyticsProduct = {
  id: string;
  name: string;
  supplier: string;
  supplierReference: string;
  category: ProductCategory;
  unit: string;
  conversionStatus: string;
};

export type SalesAnalyticsProps = {
  mode: "profit" | "materials";
  userId: string;
  recipes: SalesRecipe[];
  salesProductMappings: SalesProductMappings;
  onSalesProductMappingsChange: (next: SalesProductMappings) => void;
  inventoryCounts: InventoryCounts;
  onInventoryCountsChange: (next: InventoryCounts) => void;
  invoices: SalesAnalyticsInvoice[];
  lines: SalesAnalyticsLine[];
  products: SalesAnalyticsProduct[];
  onOpenInvoices?: () => void;
  onShowMaterials?: () => void;
};

type SalesLine = {
  product: string;
  category: string;
  quantity: number;
  totalHt: number;
};

type DailyZ = {
  id: string;
  date: string;
  revenueHt: number;
  salesLines: SalesLine[];
};

type SupplierMapping = {
  supplierProductId: string;
  catalogItemId: string;
  status: string;
  conversionFactor: number;
};

type CatalogItem = {
  id: string;
  name: string;
  baseUnit: BaseUnit | null;
};

type CatalogAlias = {
  catalogItemId: string;
  normalizedAlias: string;
  recipeUnit: BaseUnit | null;
  baseQuantityPerRecipeUnit: number;
  approximate: boolean;
};

type AnalyticsData = {
  zReports: DailyZ[];
  mappings: SupplierMapping[];
  catalogItems: CatalogItem[];
  aliases: CatalogAlias[];
  drinks: Drink[];
};

type SaleAggregate = {
  key: string;
  product: string;
  category: string;
  quantity: number;
  revenueHt: number;
};

type MaterialAggregate = {
  catalogItem: CatalogItem;
  purchased: number;
  purchaseAmountHt: number;
  theoretical: number;
};

const WORKSPACE_ID = "a617e000-0000-4000-8000-000000000001";

const FOOD_DEFAULTS: Record<string, string> = Object.fromEntries([
  ["Œufs mimosa", "recipe:e1"],
  ["Saumon", "recipe:p19"],
  ["Tartare", "recipe:p18"],
  ["Bourguignon", "recipe:p3"],
  ["Poireaux", "recipe:e2"],
  ["Crumble", "recipe:d14"],
  ["Crème Brulée", "recipe:d13"],
  ["Mousse choco", "recipe:d1"],
  ["Hareng PDT", "recipe:e5"],
].map(([label, target]) => [normalizeRecipeIngredientName(label), target]));

const DRINK_DEFAULTS: Record<string, string> = Object.fromEntries([
  ["Espresso", "drink:coffee-espresso"],
  ["Double espresso", "drink:coffee-double"],
  ["Déca", "drink:coffee-decaf"],
  ["Allongé", "drink:coffee-long"],
  ["Noisette", "drink:coffee-noisette"],
  ["Crème", "drink:coffee-cream"],
  ["Perrier 33cl", "drink:water-perrier-33"],
  ["Vittel 1L", "drink:water-vittel-100"],
  ["Vittel 50cl", "drink:water-vittel-50"],
  ["Pétillante 1L", "drink:water-sparkling-100"],
  ["Coca 33cl", "drink:soft-coca"],
  ["Coca 0 33cl", "drink:soft-coca-zero"],
  ["Orangina 25cl", "drink:soft-orangina"],
  ["Limonade 25cl", "drink:soft-limonade"],
  ["Schweppes Tonic 25cl", "drink:soft-tonic"],
  ["Ice Tea 25cl", "drink:soft-ice-tea"],
  ["Diabolo", "drink:soft-diabolo"],
  ["Pago Orange 20cl", "drink:juice-orange"],
  ["Pago Tomate 20cl", "drink:juice-tomato"],
  ["Pago Pomme 20 cl", "drink:juice-apple"],
  ["Blonde 25cl", "drink:beer-paillette-25"],
  ["Blonde 50cl", "drink:beer-paillette-50"],
  ["Blanche 25cl", "drink:beer-white-25"],
  ["Blanche 50cl", "drink:beer-white-50"],
  ["Verre de rouge", "drink:wine-red-glass"],
  ["Pichet rouge 25cl", "drink:wine-red-25"],
  ["Pichet rouge 50cl", "drink:wine-red-50"],
  ["Verre de blanc", "drink:wine-white-glass"],
  ["Pichet blanc 25cl", "drink:wine-white-25"],
  ["Pichet blanc 50cl", "drink:wine-white-50"],
].map(([label, target]) => [normalizeRecipeIngredientName(label), target]));

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function textValue(row: DbRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function numberValue(row: DbRow, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function validDate(value: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function parseZ(row: DbRow, index: number): DailyZ {
  const rawLines = Array.isArray(row.sales_lines) ? row.sales_lines : [];
  const salesLines = rawLines.flatMap((value): SalesLine[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const entry = value as DbRow;
    const product = textValue(entry, ["product", "name", "label"]);
    const quantity = numberValue(entry, ["quantity", "qty"], Number.NaN);
    const totalHt = numberValue(entry, ["total_ht", "revenue_ht", "amount_ht"], Number.NaN);
    if (!product || normalizeRecipeIngredientName(product) === "produit" || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(totalHt)) return [];
    return [{ product, quantity, totalHt, category: textValue(entry, ["category", "family"], "Non classé") }];
  });
  return {
    id: textValue(row, ["id"], `z-${index}`),
    date: validDate(textValue(row, ["report_date", "date"])),
    revenueHt: numberValue(row, ["revenue_ht"]),
    salesLines,
  };
}

function parseMapping(row: DbRow): SupplierMapping | null {
  const supplierProductId = textValue(row, ["supplier_product_id"]);
  const catalogItemId = textValue(row, ["catalog_item_id"]);
  if (!supplierProductId || !catalogItemId) return null;
  const rawFactor = numberValue(row, ["conversion_factor"], 1);
  return {
    supplierProductId,
    catalogItemId,
    status: textValue(row, ["status"], ""),
    conversionFactor: rawFactor > 0 ? rawFactor : 1,
  };
}

function resolveDrink(target: string, drinks: Drink[]): Drink | undefined {
  if (!target.startsWith("drink:")) return undefined;
  const requestedId = target.slice(6);
  const direct = drinks.find((drink) => drink.id === requestedId);
  if (direct) return direct;
  const reference = INITIAL_DRINKS.find((drink) => drink.id === requestedId);
  if (!reference) return undefined;
  const matches = drinks.filter((drink) => (
    normalizeRecipeIngredientName(drink.name) === normalizeRecipeIngredientName(reference.name)
    && normalizeRecipeIngredientName(drink.format) === normalizeRecipeIngredientName(reference.format)
  ));
  return matches.length === 1 ? matches[0] : undefined;
}

function parseCatalog(row: DbRow): CatalogItem | null {
  const id = textValue(row, ["id"]);
  if (!id) return null;
  return {
    id,
    name: textValue(row, ["name", "label"], "Article catalogue"),
    baseUnit: normalizeRecipeUnit(textValue(row, ["base_unit", "unit"])),
  };
}

function parseAlias(row: DbRow): CatalogAlias | null {
  const catalogItemId = textValue(row, ["catalog_item_id"]);
  const normalizedAlias = normalizeRecipeIngredientName(textValue(row, ["normalized_alias", "alias"]));
  const recipeUnit = normalizeRecipeUnit(textValue(row, ["recipe_unit", "unit"]));
  if (!catalogItemId || !normalizedAlias || !recipeUnit) return null;
  return {
    catalogItemId,
    normalizedAlias,
    recipeUnit,
    baseQuantityPerRecipeUnit: numberValue(row, ["base_quantity_per_recipe_unit", "conversion_factor"], 1),
    approximate: booleanValue(row.is_approximation),
  };
}

function isConfirmed(value: string) {
  return ["confirmed", "validated", "valid", "approved", "complete", "completed"].includes(normalizeRecipeIngredientName(value).replace(/ /g, "_"));
}

function isValidInvoice(invoice: SalesAnalyticsInvoice | undefined) {
  return Boolean(invoice && isConfirmed(invoice.status));
}

function isCredit(invoice: SalesAnalyticsInvoice | undefined) {
  return Boolean(invoice?.documentType.toLocaleLowerCase("fr-FR").includes("credit"));
}

function invoiceDate(invoice: SalesAnalyticsInvoice | undefined) {
  return validDate(invoice?.issueDate || invoice?.importedAt || "");
}

function formatDate(value: string) {
  return value ? shortDate.format(new Date(`${value}T12:00:00`)) : "date inconnue";
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function periodLabel(value: PeriodOption) {
  if (value === "7") return "7 derniers jours reçus";
  if (value === "30") return "30 derniers jours reçus";
  return "Tous les Z reçus";
}

function displayUnit(unit: BaseUnit | null) {
  if (unit === "g") return "kg";
  if (unit === "ml") return "L";
  return "pièces";
}

function toDisplayQuantity(value: number, unit: BaseUnit | null) {
  return unit === "g" || unit === "ml" ? value / 1000 : value;
}

function fromDisplayQuantity(value: number, unit: BaseUnit | null) {
  return unit === "g" || unit === "ml" ? value * 1000 : value;
}

function formatQuantity(value: number, unit: BaseUnit | null) {
  return `${number.format(toDisplayQuantity(value, unit))} ${displayUnit(unit)}`;
}

function mappingReason(
  line: SalesAnalyticsLine,
  product: SalesAnalyticsProduct | undefined,
  confirmedMapping: SupplierMapping | undefined,
  catalogItem: CatalogItem | undefined,
  usedCatalogIds: Set<string>,
) {
  const currentConversionStatus = (product?.conversionStatus ?? "").toLocaleLowerCase("fr-FR");
  if (!confirmedMapping) {
    if (/review|verify|conversion|ambiguous|pending/.test(`${currentConversionStatus} ${line.mappingStatus}`)) return "Conversion à vérifier";
    return "Aucun article catalogue exact";
  }
  const normalizedUnit = normalizeRecipeUnit(line.normalizedUnit);
  if (line.normalizedQuantity === null || !normalizedUnit || !catalogItem?.baseUnit || normalizedUnit !== catalogItem.baseUnit || /review|verify|ambiguous|pending/.test(currentConversionStatus)) {
    return "Conversion à vérifier";
  }
  if (!usedCatalogIds.has(confirmedMapping.catalogItemId)) return "Article catalogue sans correspondance dans les recettes actuelles";
  return "";
}

async function fetchWorkspaceRows(table: string): Promise<DbRow[]> {
  const pageSize = 1000;
  const rows: DbRow[] = [];
  for (let page = 0; ; page += 1) {
    let result = await supabase
      .from(table)
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (result.error && /workspace_id/i.test(result.error.message)) {
      result = await supabase.from(table).select("*").range(page * pageSize, (page + 1) * pageSize - 1);
    }
    if (result.error) throw result.error;
    const pageRows = (result.data ?? []) as unknown as DbRow[];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

export default function SalesPurchasesAnalytics({
  mode,
  userId,
  recipes,
  salesProductMappings,
  onSalesProductMappingsChange,
  inventoryCounts,
  onInventoryCountsChange,
  invoices,
  lines,
  products,
  onOpenInvoices,
  onShowMaterials,
}: SalesAnalyticsProps) {
  const [period, setPeriod] = useState<PeriodOption>("all");
  const [data, setData] = useState<AnalyticsData>({ zReports: [], mappings: [], catalogItems: [], aliases: [], drinks: INITIAL_DRINKS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const aliveRef = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [zRows, mappingRows, catalogRows, aliasRows, barState] = await Promise.all([
        fetchWorkspaceRows("auguste_daily_z_reports"),
        fetchWorkspaceRows("auguste_supplier_product_mappings"),
        fetchWorkspaceRows("auguste_catalog_items"),
        fetchWorkspaceRows("auguste_catalog_item_aliases"),
        loadSharedState("bar").catch(() => null),
      ]);
      if (!aliveRef.current) return;
      const drinks = barState && Array.isArray(barState.payload.drinks)
        ? barState.payload.drinks as Drink[]
        : INITIAL_DRINKS;
      setData({
        zReports: zRows.map(parseZ).filter((row) => row.date).sort((left, right) => left.date.localeCompare(right.date)),
        mappings: mappingRows.map(parseMapping).filter((row): row is SupplierMapping => Boolean(row)),
        catalogItems: catalogRows.map(parseCatalog).filter((row): row is CatalogItem => Boolean(row)),
        aliases: aliasRows.map(parseAlias).filter((row): row is CatalogAlias => Boolean(row)),
        drinks,
      });
    } catch (loadError) {
      console.warn("Le comparatif ventes-achats n’a pas pu être chargé.", loadError);
      if (!aliveRef.current) return;
      setError("Le comparatif n’est pas disponible pour le moment. Les factures restent accessibles.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void loadData();
    let timer: number | undefined;
    const scheduleLoad = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadData(), 400);
    };
    const channel = supabase
      .channel(`auguste-sales-analytics:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_daily_z_reports" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_supplier_product_mappings" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_catalog_items" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_catalog_item_aliases" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "auguste_shared_state", filter: "section=eq.bar" }, scheduleLoad)
      .subscribe();
    return () => {
      aliveRef.current = false;
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [loadData, userId]);

  const periodRange = useMemo(() => {
    const first = data.zReports.at(0)?.date ?? "";
    const latest = data.zReports.at(-1)?.date ?? "";
    const start = latest && period !== "all" ? addDays(latest, -(Number(period) - 1)) : first;
    return { start, end: latest };
  }, [data.zReports, period]);

  const periodReports = useMemo(() => data.zReports.filter((report) => (
    (!periodRange.start || report.date >= periodRange.start)
    && (!periodRange.end || report.date <= periodRange.end)
  )), [data.zReports, periodRange]);

  const sales = useMemo<SaleAggregate[]>(() => {
    const grouped = new Map<string, SaleAggregate>();
    periodReports.forEach((report) => report.salesLines.forEach((line) => {
      const key = normalizeRecipeIngredientName(line.product);
      const current = grouped.get(key) ?? { key, product: line.product, category: line.category, quantity: 0, revenueHt: 0 };
      current.quantity += line.quantity;
      current.revenueHt += line.totalHt;
      grouped.set(key, current);
    }));
    return [...grouped.values()].sort((left, right) => right.revenueHt - left.revenueHt);
  }, [periodReports]);

  const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const drinkById = useMemo(() => new Map(data.drinks.map((drink) => [drink.id, drink])), [data.drinks]);
  const resolvedSales = useMemo(() => sales.map((sale) => {
    const explicit = Object.prototype.hasOwnProperty.call(salesProductMappings, sale.key);
    const defaultTarget = FOOD_DEFAULTS[sale.key] ?? DRINK_DEFAULTS[sale.key] ?? "";
    const target = explicit ? salesProductMappings[sale.key] : defaultTarget;
    const recipe = target.startsWith("recipe:") ? recipeById.get(target.slice(7)) : undefined;
    const drink = target.startsWith("drink:") ? drinkById.get(target.slice(6)) ?? resolveDrink(target, data.drinks) : undefined;
    const resolvedTarget = drink && target.startsWith("drink:") ? `drink:${drink.id}` : target;
    const costUnit = recipe
      ? Math.max(0, recipe.costHt)
      : drink && typeof drink.purchasePriceHt === "number"
        ? Math.max(0, drink.purchasePriceHt) + Math.max(0, drink.extrasHt || 0)
        : null;
    const avgRevenue = sale.quantity > 0 ? sale.revenueHt / sale.quantity : 0;
    const costTotal = costUnit === null ? null : costUnit * sale.quantity;
    const profitTotal = costTotal === null ? null : sale.revenueHt - costTotal;
    const confidence = recipe
      ? recipe.costIsFloor ? `À vérifier — ${recipe.costQuality}` : recipe.costQuality
      : drink ? costUnit === null ? "À compléter — coût boisson manquant" : "Coût bar actuel"
        : "À rapprocher — aucun coût matière appliqué";
    return {
      ...sale,
      target: resolvedTarget,
      recipe,
      drink,
      costUnit,
      avgRevenue,
      costTotal,
      profitUnit: costUnit === null ? null : avgRevenue - costUnit,
      profitTotal,
      margin: profitTotal === null || sale.revenueHt === 0 ? null : profitTotal / sale.revenueHt,
      confidence,
    };
  }), [data.drinks, drinkById, recipeById, sales, salesProductMappings]);

  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const confirmedMappingByProduct = useMemo(() => {
    const map = new Map<string, SupplierMapping>();
    data.mappings.forEach((mapping) => {
      if (isConfirmed(mapping.status)) map.set(mapping.supplierProductId, mapping);
    });
    return map;
  }, [data.mappings]);
  const catalogById = useMemo(() => new Map(data.catalogItems.map((item) => [item.id, item])), [data.catalogItems]);

  const exactAliasMap = useMemo(() => {
    const candidates = new Map<string, CatalogAlias[]>();
    data.aliases.forEach((alias) => {
      if (alias.approximate || !alias.recipeUnit || alias.baseQuantityPerRecipeUnit <= 0) return;
      const key = `${alias.normalizedAlias}\u0000${alias.recipeUnit}`;
      candidates.set(key, [...(candidates.get(key) ?? []), alias]);
    });
    const exact = new Map<string, CatalogAlias>();
    candidates.forEach((aliases, key) => {
      const catalogIds = new Set(aliases.map((alias) => alias.catalogItemId));
      if (catalogIds.size === 1) exact.set(key, aliases[0]);
    });
    return exact;
  }, [data.aliases]);

  const mappedRecipeQuantities = useMemo(() => {
    const result = new Map<string, number>();
    resolvedSales.forEach((sale) => {
      if (sale.recipe) result.set(sale.recipe.id, (result.get(sale.recipe.id) ?? 0) + sale.quantity);
    });
    return result;
  }, [resolvedSales]);

  const theoreticalByCatalog = useMemo(() => {
    const totals = new Map<string, number>();
    mappedRecipeQuantities.forEach((soldQuantity, recipeId) => {
      const recipe = recipeById.get(recipeId);
      recipe?.ingredients.forEach((ingredient) => {
        const unit = normalizeRecipeUnit(ingredient.unit);
        if (!unit || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) return;
        const key = `${normalizeRecipeIngredientName(ingredient.name)}\u0000${unit}`;
        const alias = exactAliasMap.get(key);
        if (!alias) return;
        totals.set(alias.catalogItemId, (totals.get(alias.catalogItemId) ?? 0) + ingredient.quantity * alias.baseQuantityPerRecipeUnit * soldQuantity);
      });
    });
    return totals;
  }, [exactAliasMap, mappedRecipeQuantities, recipeById]);

  const usedCatalogIds = useMemo(() => {
    const ids = new Set<string>();
    recipes.forEach((recipe) => recipe.ingredients.forEach((ingredient) => {
      const unit = normalizeRecipeUnit(ingredient.unit);
      const alias = unit ? exactAliasMap.get(`${normalizeRecipeIngredientName(ingredient.name)}\u0000${unit}`) : undefined;
      if (alias) ids.add(alias.catalogItemId);
    }));
    return ids;
  }, [exactAliasMap, recipes]);

  const periodLines = useMemo(() => lines.filter((line) => {
    const invoice = invoiceById.get(line.invoiceId);
    const date = invoiceDate(invoice);
    return Boolean(periodRange.start && periodRange.end)
      && isValidInvoice(invoice)
      && (!periodRange.start || date >= periodRange.start)
      && (!periodRange.end || date <= periodRange.end);
  }), [invoiceById, lines, periodRange]);

  const materialRows = useMemo<MaterialAggregate[]>(() => {
    const grouped = new Map<string, MaterialAggregate>();
    theoreticalByCatalog.forEach((theoretical, catalogItemId) => {
      const catalogItem = catalogById.get(catalogItemId);
      if (catalogItem) grouped.set(catalogItemId, { catalogItem, purchased: 0, purchaseAmountHt: 0, theoretical });
    });
    periodLines.forEach((line) => {
      const category = productById.get(line.productId)?.category ?? line.category;
      if (category === "non_food") return;
      const mapping = confirmedMappingByProduct.get(line.productId);
      const catalogItem = mapping ? catalogById.get(mapping.catalogItemId) : undefined;
      const normalizedUnit = normalizeRecipeUnit(line.normalizedUnit);
      if (!mapping || !catalogItem || !normalizedUnit || normalizedUnit !== catalogItem.baseUnit || line.normalizedQuantity === null) return;
      const current = grouped.get(catalogItem.id) ?? { catalogItem, purchased: 0, purchaseAmountHt: 0, theoretical: 0 };
      // Financial credit notes do not prove a physical stock return. They
      // reduce accounting spend elsewhere, but never alter stock quantities.
      if (isCredit(invoiceById.get(line.invoiceId))) return;
      current.purchased += Math.abs(line.normalizedQuantity) * mapping.conversionFactor;
      current.purchaseAmountHt += Math.abs(line.totalHt ?? 0);
      grouped.set(catalogItem.id, current);
    });
    return [...grouped.values()]
      .filter((row) => Math.abs(row.purchased) > 0.0001 || row.theoretical > 0.0001)
      .sort((left, right) => Math.max(right.purchased, right.theoretical) - Math.max(left.purchased, left.theoretical));
  }, [catalogById, confirmedMappingByProduct, invoiceById, periodLines, productById, theoreticalByCatalog]);

  const unmatchedInvoiceLines = useMemo(() => lines.filter((line) => isValidInvoice(invoiceById.get(line.invoiceId))).flatMap((line) => {
    const product = productById.get(line.productId);
    const category = product?.category ?? line.category;
    if (category === "non_food") return [];
    const mapping = confirmedMappingByProduct.get(line.productId);
    const reason = mappingReason(line, product, mapping, mapping ? catalogById.get(mapping.catalogItemId) : undefined, usedCatalogIds);
    if (!reason) return [];
    return [{ line, product, invoice: invoiceById.get(line.invoiceId), reason }];
  }).sort((left, right) => invoiceDate(right.invoice).localeCompare(invoiceDate(left.invoice))), [catalogById, confirmedMappingByProduct, invoiceById, lines, productById, usedCatalogIds]);

  const excludedNonFoodCount = useMemo(() => lines.filter((line) => isValidInvoice(invoiceById.get(line.invoiceId)) && (productById.get(line.productId)?.category ?? line.category) === "non_food").length, [invoiceById, lines, productById]);

  const selectedZRevenue = periodReports.reduce((sum, report) => sum + report.revenueHt, 0);
  const shownSalesRevenue = resolvedSales.reduce((sum, sale) => sum + sale.revenueHt, 0);
  const knownCost = resolvedSales.reduce((sum, sale) => sum + (sale.costTotal ?? 0), 0);
  const knownRevenue = resolvedSales.reduce((sum, sale) => sum + (sale.costTotal === null ? 0 : sale.revenueHt), 0);
  const knownProfit = knownRevenue - knownCost;
  const mappedCount = resolvedSales.filter((sale) => sale.costTotal !== null).length;

  function updateMapping(key: string, target: string) {
    onSalesProductMappingsChange({ ...salesProductMappings, [key]: target });
  }

  function updateInventory(catalogItem: CatalogItem, field: "opening" | "closing", rawValue: string) {
    const storageKey = `${periodRange.start}:${periodRange.end}:${catalogItem.id}`;
    const parsed = rawValue.trim() === "" ? null : Number(rawValue.replace(",", "."));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
    const current = inventoryCounts[storageKey] ?? { opening: null, closing: null };
    onInventoryCountsChange({
      ...inventoryCounts,
      [storageKey]: { ...current, [field]: parsed === null ? null : fromDisplayQuantity(parsed, catalogItem.baseUnit) },
    });
  }

  if (loading) return <div className="sales-analysis-state">Chargement des ventes, achats et correspondances…</div>;
  if (error) return <div className="sales-analysis-state error"><strong>Comparatif indisponible</strong><span>{error}</span><button type="button" onClick={() => void loadData()}>Réessayer</button></div>;

  return (
    <section className="sales-analysis">
      <div className="sales-analysis-toolbar">
        <div>
          <span className="sales-analysis-eyebrow">Période analysée</span>
          <strong>{periodRange.start && periodRange.end ? `${formatDate(periodRange.start)} → ${formatDate(periodRange.end)}` : "Aucun Z reçu"}</strong>
        </div>
        <label>
          <span>Afficher</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodOption)}>
            {(["all", "7", "30"] as const).map((value) => <option key={value} value={value}>{periodLabel(value)}</option>)}
          </select>
        </label>
        <button className="sales-analysis-refresh" type="button" onClick={() => void loadData()}>Actualiser</button>
      </div>

      <div className="sales-analysis-banner warning">
        <strong>Historique incomplet : {data.zReports.length} journée{data.zReports.length > 1 ? "s" : ""} renseignée{data.zReports.length > 1 ? "s" : ""}</strong>
        <span>{data.zReports.length
          ? `Données disponibles du ${formatDate(data.zReports[0].date)} au ${formatDate(data.zReports.at(-1)?.date ?? "")}. Aucun résultat n’est extrapolé aux jours manquants.`
          : "Aucun Z n’est encore disponible : les ventes et consommations théoriques ne peuvent pas être calculées."}</span>
      </div>

      {mode === "profit" ? (
        <>
          <div className="sales-analysis-kpis">
            <article><span>CA HT des lignes</span><strong>{euro.format(shownSalesRevenue)}</strong><small>Z sélectionnés : {euro.format(selectedZRevenue)}</small></article>
            <article><span>Coût matière actuel connu</span><strong>{euro.format(knownCost)}</strong><small>{mappedCount}/{resolvedSales.length} produits rapprochés</small></article>
            <article className="accent"><span>Bénéfice brut matière connu</span><strong>{euro.format(knownProfit)}</strong><small>{knownRevenue > 0 ? `${percent.format(knownProfit / knownRevenue)} du CA rapproché` : "Marge non calculable"}</small></article>
          </div>

          <div className="sales-analysis-banner info">
            <strong>Lecture du bénéfice</strong>
            <span>Le bénéfice brut matière = vente HT − coût matière. Ce n’est pas un bénéfice net : salaires, énergie, loyer et autres charges ne sont pas déduits. Les coûts appliqués sont les coûts actuels, pas les coûts historiques du jour de vente.</span>
          </div>

          {unmatchedInvoiceLines.length > 0 && (
            <div className="sales-unmatched-alert" role="status">
              <div>
                <strong>{unmatchedInvoiceLines.length} produit{unmatchedInvoiceLines.length > 1 ? "s" : ""} de facture sans correspondance recette certaine</strong>
                <span>{unmatchedInvoiceLines.slice(0, 3).map(({ line }) => line.description).join(" · ")}{unmatchedInvoiceLines.length > 3 ? ` · +${unmatchedInvoiceLines.length - 3}` : ""}</span>
              </div>
              {onShowMaterials && <button type="button" onClick={onShowMaterials}>Voir lesquels</button>}
            </div>
          )}

          <div className="sales-profit-list">
            {resolvedSales.length ? resolvedSales.map((sale) => (
              <article className={`sales-profit-card ${sale.costTotal === null ? "unmatched" : ""}`} key={sale.key}>
                <header>
                  <div><span className="sales-analysis-eyebrow">{sale.category || "Non classé"}</span><h3>{sale.product}</h3></div>
                  <strong>{number.format(sale.quantity)} vendu{sale.quantity > 1 ? "s" : ""}</strong>
                </header>
                <label className="sales-mapping-select">
                  <span>Correspondance coût matière</span>
                  <select value={sale.target} onChange={(event) => updateMapping(sale.key, event.target.value)}>
                    <option value="">À rapprocher</option>
                    <optgroup label="Recettes cuisine">
                      {recipes.map((recipe) => <option value={`recipe:${recipe.id}`} key={recipe.id}>{recipe.name}</option>)}
                    </optgroup>
                    <optgroup label="Produits bar">
                      {data.drinks.map((drink) => <option value={`drink:${drink.id}`} key={drink.id}>{drink.name} — {drink.format}</option>)}
                    </optgroup>
                  </select>
                </label>
                <div className="sales-profit-metrics">
                  <div><span>CA HT</span><strong>{euro.format(sale.revenueHt)}</strong></div>
                  <div><span>Prix moyen HT</span><strong>{euro.format(sale.avgRevenue)}</strong></div>
                  <div><span>Coût matière / u.</span><strong>{sale.costUnit === null ? "—" : euro.format(sale.costUnit)}</strong></div>
                  <div><span>Coût matière total</span><strong>{sale.costTotal === null ? "—" : euro.format(sale.costTotal)}</strong></div>
                  <div><span>Bénéfice brut / u.</span><strong>{sale.profitUnit === null ? "—" : euro.format(sale.profitUnit)}</strong></div>
                  <div className="primary"><span>Bénéfice brut total</span><strong>{sale.profitTotal === null ? "À rapprocher" : euro.format(sale.profitTotal)}</strong></div>
                  <div><span>Marge matière</span><strong>{sale.margin === null ? "—" : percent.format(sale.margin)}</strong></div>
                </div>
                <p className={`sales-confidence ${sale.costTotal === null || sale.recipe?.costIsFloor ? "review" : ""}`}>{sale.confidence}</p>
              </article>
            )) : <div className="sales-analysis-empty">Aucune ligne de vente dans les Z sélectionnés.</div>}
          </div>
        </>
      ) : (
        <>
          <div className="sales-analysis-banner info">
            <strong>Achats → consommation → perte</strong>
            <span>Le solde théorique compare les quantités facturées aux quantités prévues par les fiches techniques. Une perte réelle n’est affichée qu’avec un inventaire physique d’ouverture et de clôture.</span>
          </div>
          <div className="material-list">
            {materialRows.length ? materialRows.map((row) => {
              const storageKey = `${periodRange.start}:${periodRange.end}:${row.catalogItem.id}`;
              const count = inventoryCounts[storageKey] ?? { opening: null, closing: null };
              const hasInventory = count.opening !== null && count.closing !== null;
              const actualUsed = hasInventory ? count.opening! + row.purchased - count.closing! : null;
              const variance = actualUsed === null ? null : actualUsed - row.theoretical;
              const averageCost = row.purchased > 0 ? row.purchaseAmountHt / row.purchased : null;
              const varianceCost = variance !== null && averageCost !== null ? variance * averageCost : null;
              const usage = row.purchased > 0 ? row.theoretical / row.purchased : null;
              return (
                <article className="material-card" key={row.catalogItem.id}>
                  <header><div><span className="sales-analysis-eyebrow">{row.catalogItem.baseUnit ? `Unité de base : ${row.catalogItem.baseUnit}` : "Unité à vérifier"}</span><h3>{row.catalogItem.name}</h3></div>{usage !== null && <strong>{percent.format(usage)} passé</strong>}</header>
                  <div className="material-flow">
                    <div><span>Acheté</span><strong>{formatQuantity(row.purchased, row.catalogItem.baseUnit)}</strong></div>
                    <div><span>Consommé théorique</span><strong>{formatQuantity(row.theoretical, row.catalogItem.baseUnit)}</strong></div>
                    <div><span>Solde théorique</span><strong>{formatQuantity(row.purchased - row.theoretical, row.catalogItem.baseUnit)}</strong></div>
                  </div>
                  <div className="inventory-entry">
                    <label><span>Stock ouverture ({displayUnit(row.catalogItem.baseUnit)})</span><input inputMode="decimal" type="number" min="0" step="0.01" value={count.opening === null ? "" : String(toDisplayQuantity(count.opening, row.catalogItem.baseUnit))} placeholder="À saisir" onChange={(event) => updateInventory(row.catalogItem, "opening", event.target.value)} /></label>
                    <label><span>Stock clôture ({displayUnit(row.catalogItem.baseUnit)})</span><input inputMode="decimal" type="number" min="0" step="0.01" value={count.closing === null ? "" : String(toDisplayQuantity(count.closing, row.catalogItem.baseUnit))} placeholder="À saisir" onChange={(event) => updateInventory(row.catalogItem, "closing", event.target.value)} /></label>
                  </div>
                  {variance === null ? <p className="loss-result pending">Perte non mesurable — inventaire requis</p> : (
                    <p className={`loss-result ${variance > 0 ? "loss" : "ok"}`}>
                      <span>{variance > 0 ? "Perte / surconsommation mesurée" : variance < 0 ? "Écart négatif — stock ou fiches à contrôler" : "Aucun écart mesuré"}</span>
                      <strong>{formatQuantity(Math.abs(variance), row.catalogItem.baseUnit)}{varianceCost !== null ? ` · ${euro.format(Math.abs(varianceCost))}` : ""}</strong>
                    </p>
                  )}
                </article>
              );
            }) : <div className="sales-analysis-empty">Aucune quantité comparable sur la période. Vérifiez les correspondances catalogue et recettes.</div>}
          </div>
        </>
      )}

      {mode === "materials" && <section className="invoice-unmatched">
        <header>
          <div><span className="sales-analysis-eyebrow">À traiter</span><h2>Produits facturés sans correspondance recette certaine</h2><p>Chaque ligne est conservée telle qu’elle apparaît sur sa facture. Aucun rapprochement approximatif n’est appliqué.</p></div>
          {onOpenInvoices && <button type="button" onClick={onOpenInvoices}>Voir les factures</button>}
        </header>
        {unmatchedInvoiceLines.length ? (
          <div className="invoice-unmatched-list">
            {unmatchedInvoiceLines.map(({ line, product, invoice, reason }) => (
              <article key={line.id}>
                <div className="invoice-unmatched-main"><strong>{line.description}</strong><span>{invoice?.supplier || product?.supplier || "Fournisseur"} · facture {invoice?.invoiceNumber || "sans numéro"} · {formatDate(invoiceDate(invoice))}</span></div>
                <div className="invoice-unmatched-facts">
                  <span><b>SKU</b> {product?.supplierReference || line.supplierReference || "non indiqué"}</span>
                  <span><b>Quantité</b> {line.quantity === null ? "non indiquée" : `${number.format(line.quantity)} ${line.unit}`}</span>
                </div>
                <p>{reason}</p>
              </article>
            ))}
          </div>
        ) : <div className="invoice-unmatched-ok">Toutes les lignes alimentaires et boissons des factures validées ont une correspondance recette exacte.</div>}
        <small>{excludedNonFoodCount
          ? `${excludedNonFoodCount} ligne${excludedNonFoodCount > 1 ? "s" : ""} non alimentaire${excludedNonFoodCount > 1 ? "s" : ""} exclue${excludedNonFoodCount > 1 ? "s" : ""} : elles n’entrent jamais dans le coût matière.`
          : "Les produits non alimentaires sont exclus du coût matière et de cette liste d’action."}</small>
      </section>}
    </section>
  );
}
